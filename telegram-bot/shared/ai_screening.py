"""AI screening and conversation handling using Claude."""
import os
import re
import json
from anthropic import Anthropic

# Conversation memory (max 10 messages per user)
conversations = {}
# Conversation state tracking for each user
conversation_states = {}
MAX_MESSAGES = 10

# Configuration for the recruiter
RECRUITER_NAME = os.environ.get('RECRUITER_NAME', 'Ai Wei')
COMPANY_NAME = os.environ.get('COMPANY_NAME', 'CGP')
APPLICATION_FORM_URL = os.environ.get('APPLICATION_FORM_URL', 'Shorturl.at/kmvJ6')

SYSTEM_PROMPT = f"""You are {RECRUITER_NAME}, a recruiter from {COMPANY_NAME} (Cornerstone Global Partners). You communicate with candidates via WhatsApp in a friendly, casual yet professional manner.

## YOUR COMMUNICATION STYLE:
- Use casual abbreviations: "u" for "you", "ur" for "your", "cos" for "because"
- Keep messages short and conversational
- IMPORTANT: Only use ":)" ONCE in the initial greeting message. Do NOT add ":)" to every message.
- Use casual affirmations like "yep of cos", "can can", "ok sure"
- Always address candidates by their first name
- Be warm but professional
- Use lowercase for casual words, avoid being overly formal

## CONVERSATION FLOW (follow this sequence):

### Stage 1: Initial Contact
When a candidate first reaches out about a job:
"Hi [Name], I am {RECRUITER_NAME} from {COMPANY_NAME}. Thank you for applying for the [Job Role] role. Could you kindly fill up the Application Form here: {APPLICATION_FORM_URL}
Consultant Name is {RECRUITER_NAME} (Pls find the dropdown list of my name)
As soon as you are finished, please let me know. Thank you!"

### Stage 2: After Form Completion
When the candidate says they completed the form, ask for resume:
"can i have ur resume please?"

### Stage 3: After Resume Received
IMPORTANT: Once the resume has been received, NEVER ask for it again. Instead:
- Ask about relevant experience for the job
- For Barista: "do u have experience making coffee with latte art"
- For Researcher: "do u have experience with phone surveys or data collection"
- For Event Crew: "do u have experience with events or customer service"

### Stage 4: Schedule Call
After gathering information:
"hi [Name], let me know when is a good time to call u back"

### Stage 5: Closing the Conversation
After the call is scheduled or if candidate has provided all needed info:
"thanks for ur time! will review ur application and contact u if u are shortlisted"
or
"noted, our team will review and get back to u if shortlisted. have a good day!"

Use this closing message when:
- Candidate has completed form, sent resume, answered experience questions
- A call time has been agreed upon
- The conversation has naturally reached its end

## CRITICAL RULES:
1. Only use ":)" ONCE in the initial greeting. Do NOT add ":)" to subsequent messages.
2. NEVER ask for resume if it has already been received (check CURRENT CANDIDATE STATE below)
3. ALWAYS ask for the application form to be filled FIRST before asking for resume
4. Ask role-specific experience questions after resume is received
5. Be patient if candidate is busy - offer to call at a convenient time
6. If candidate says they can make an interview time, confirm with "noted, see u then"

## CONTEXT AWARENESS:
Track where the candidate is in the process:
- If they haven't filled the form yet → Guide them to fill the form
- If they filled the form but no resume → Ask for resume (ONCE only)
- If resume received → NEVER ask for resume again. Ask role-specific questions instead.
- If experience discussed → Schedule a phone call
- If call scheduled or conversation complete → Close with "will contact u if shortlisted"

Always be helpful and answer any questions they have about the job or process."""

SCREENING_PROMPT = """Here are the available job roles with their requirements and scoring guides (format: Job Title, Requirements, Scoring Guide):

{job_roles}

RESUME TEXT:
{resume_text}

Please analyze this resume and provide a screening assessment.

1. First, identify which job role the candidate is applying for. Match it to one of the available roles. If the message does not clearly indicate a role, select the most suitable role based on the candidates experience.

2. Then analyze this resume against that specific roles requirements and scoring guide.

3. Extract the candidates email address and phone number from the resume if available.

IMPORTANT CITIZENSHIP REQUIREMENT: Candidates MUST be Singapore Citizens or Permanent Residents. Look for indicators such as: NRIC number (starts with S or T for citizens, F or G for PRs), National Service or NS completion, Singapore address, local education (Singapore polytechnics like Ngee Ann or Temasek, universities like NUS NTU SMU SIT SUSS, or local schools), or explicit mention of citizenship or PR status. If no clear indicator of Singapore Citizen or PR status is found, set recommendation to Rejected regardless of qualifications.

Please include a JSON block in your response with these fields:
{{
  "candidate_name": "Full name from resume",
  "candidate_email": "email@example.com or null",
  "candidate_phone": "+65 XXXX XXXX or null",
  "job_matched": "matched role name",
  "score": 7,
  "citizenship_status": "Singapore Citizen",
  "recommendation": "Top Candidate",
  "summary": "Brief evaluation text"
}}

Note: score should be a number from 1-10, citizenship_status should be one of: Singapore Citizen, PR, Unknown, or Foreigner. recommendation should be one of: Top Candidate, Review, or Rejected.

Use the scoring guide for the matched role."""

# Global client
anthropic_client = None


def init_anthropic(api_key: str = None):
    """Initialize the Anthropic client."""
    global anthropic_client
    key = api_key or os.environ.get('CLAUDE_API_KEY')
    if not key:
        raise ValueError("CLAUDE_API_KEY not set")
    anthropic_client = Anthropic(api_key=key)
    return anthropic_client


def get_conversation(user_id: str) -> list:
    """Get conversation history for a user."""
    user_key = str(user_id)
    if user_key not in conversations:
        conversations[user_key] = []
    return conversations[user_key]


def add_message(user_id: str, role: str, content: str):
    """Add a message to conversation history."""
    conv = get_conversation(user_id)
    conv.append({"role": role, "content": content})
    if len(conv) > MAX_MESSAGES * 2:
        conv[:] = conv[-MAX_MESSAGES * 2:]


# Conversation state constants
STATE_NEW = "new"
STATE_FORM_SENT = "form_sent"
STATE_FORM_COMPLETED = "form_completed"
STATE_RESUME_REQUESTED = "resume_requested"
STATE_RESUME_RECEIVED = "resume_received"
STATE_EXPERIENCE_ASKED = "experience_asked"
STATE_CALL_SCHEDULING = "call_scheduling"
STATE_CONVERSATION_CLOSED = "conversation_closed"


def get_conversation_state(user_id: str) -> dict:
    """Get the conversation state for a user."""
    user_key = str(user_id)
    if user_key not in conversation_states:
        conversation_states[user_key] = {
            "stage": STATE_NEW,
            "applied_role": None,
            "candidate_name": None,
            "resume_received": False,
            "form_completed": False,
            "experience_discussed": False,
            "call_scheduled": False
        }
    return conversation_states[user_key]


def update_conversation_state(user_id: str, **kwargs):
    """Update the conversation state for a user."""
    state = get_conversation_state(user_id)
    state.update(kwargs)
    return state


def detect_state_from_message(user_id: str, message: str) -> dict:
    """Detect and update conversation state based on user message."""
    state = get_conversation_state(user_id)
    message_lower = message.lower()

    # Detect form completion
    form_completion_keywords = [
        "done", "completed", "finished", "filled", "submitted",
        "i've completed", "i have completed", "just completed",
        "form done", "already done"
    ]
    if any(keyword in message_lower for keyword in form_completion_keywords):
        if not state["form_completed"]:
            update_conversation_state(user_id, form_completed=True, stage=STATE_FORM_COMPLETED)

    # Detect if candidate mentions a job role
    job_keywords = {
        "barista": "Part-Time Barista",
        "coffee": "Part-Time Barista",
        "researcher": "Phone Researcher",
        "phone researcher": "Phone Researcher",
        "government researcher": "Phone Researcher",
        "event crew": "Event Crew",
        "carnival": "Event Crew",
        "christmas": "Event Crew",
        "part time": None,  # Generic part-time
        "admin": "Admin Assistant",
        "customer service": "Customer Service",
        "promoter": "Promoter",
    }
    for keyword, role in job_keywords.items():
        if keyword in message_lower and role:
            update_conversation_state(user_id, applied_role=role)
            break

    # Detect interview/call confirmation
    interview_keywords = ["interview", "can make it", "available", "confirm"]
    if any(keyword in message_lower for keyword in interview_keywords):
        if "time" in message_lower or "pm" in message_lower or "am" in message_lower:
            update_conversation_state(user_id, call_scheduled=True, stage=STATE_CALL_SCHEDULING)

    # Detect call time confirmation (candidate gives specific time)
    time_patterns = ["pm", "am", "oclock", "o'clock", "mins", "minutes", "call me", "call u"]
    if any(pattern in message_lower for pattern in time_patterns):
        if state['experience_discussed']:
            update_conversation_state(user_id, call_scheduled=True, stage=STATE_CALL_SCHEDULING)

    return state


def get_state_context(user_id: str) -> str:
    """Generate context string for the AI based on current conversation state."""
    state = get_conversation_state(user_id)

    context_parts = []
    context_parts.append(f"\n\n## CURRENT CANDIDATE STATE:")
    context_parts.append(f"- Stage: {state['stage']}")

    if state['candidate_name']:
        context_parts.append(f"- Candidate Name: {state['candidate_name']}")

    if state['applied_role']:
        context_parts.append(f"- Applied Role: {state['applied_role']}")

    context_parts.append(f"- Form Completed: {'Yes' if state['form_completed'] else 'No'}")
    context_parts.append(f"- Resume Received: {'Yes' if state['resume_received'] else 'No'}")
    context_parts.append(f"- Experience Discussed: {'Yes' if state['experience_discussed'] else 'No'}")
    context_parts.append(f"- Call Scheduled: {'Yes' if state['call_scheduled'] else 'No'}")

    # Add strong warning if resume already received
    if state['resume_received']:
        context_parts.append("\n⚠️ IMPORTANT: RESUME HAS ALREADY BEEN RECEIVED. DO NOT ASK FOR RESUME AGAIN!")

    # Add guidance based on current state
    context_parts.append("\n## NEXT ACTION:")
    if state['stage'] == STATE_NEW:
        context_parts.append("→ Send application form link and ask candidate to fill it")
    elif state['stage'] == STATE_FORM_SENT and not state['form_completed']:
        context_parts.append("→ Wait for candidate to complete the form, or gently remind them")
    elif state['form_completed'] and not state['resume_received']:
        context_parts.append("→ Ask for their resume (ONCE only)")
    elif state['resume_received'] and not state['experience_discussed']:
        context_parts.append("→ Ask role-specific experience questions (resume already received - do NOT ask for it)")
    elif state['experience_discussed'] and not state['call_scheduled']:
        context_parts.append("→ Schedule a phone call")
    elif state['call_scheduled']:
        context_parts.append("→ CLOSE the conversation: thank them and say 'will contact u if shortlisted'")

    return "\n".join(context_parts)


async def get_ai_response(user_id: str, message: str, candidate_name: str = None) -> str:
    """Get AI response for a user message."""
    global anthropic_client

    if not anthropic_client:
        init_anthropic()

    # Ensure message is not empty
    if not message or not message.strip():
        message = "[Empty message]"

    # Update state based on message content
    detect_state_from_message(user_id, message)

    # Store candidate name if provided
    if candidate_name:
        update_conversation_state(user_id, candidate_name=candidate_name)

    add_message(user_id, "user", message)

    # Filter out any empty messages from conversation history
    valid_messages = [
        msg for msg in get_conversation(user_id)
        if msg.get("content") and msg["content"].strip()
    ]

    if not valid_messages:
        # First message - send application form
        state = get_conversation_state(user_id)
        update_conversation_state(user_id, stage=STATE_FORM_SENT)
        name = candidate_name or "there"
        return f"Hi {name}, I am {RECRUITER_NAME} from {COMPANY_NAME}. Thank you for reaching out! Could you kindly fill up the Application Form here: {APPLICATION_FORM_URL}\nConsultant Name is {RECRUITER_NAME} (Pls find the dropdown list of my name)\nAs soon as you are finished, please let me know. Thank you!"

    # Add state context to system prompt
    state_context = get_state_context(user_id)
    enhanced_prompt = SYSTEM_PROMPT + state_context

    try:
        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=enhanced_prompt,
            messages=valid_messages
        )
        ai_message = response.content[0].text
        add_message(user_id, "assistant", ai_message)

        # Update state if we sent form link
        if APPLICATION_FORM_URL in ai_message:
            update_conversation_state(user_id, stage=STATE_FORM_SENT)

        # Update state if we asked for resume
        if "resume" in ai_message.lower():
            state = get_conversation_state(user_id)
            if state['form_completed']:
                update_conversation_state(user_id, stage=STATE_RESUME_REQUESTED)

        return ai_message
    except Exception as e:
        print(f"Error getting AI response: {e}")
        return "I apologize, but I'm having trouble processing your message. Please try again."


def mark_resume_received(user_id: str, applied_role: str = None):
    """Mark that a resume has been received for this user."""
    update_conversation_state(
        user_id,
        resume_received=True,
        stage=STATE_RESUME_RECEIVED,
        applied_role=applied_role
    )


async def screen_resume(resume_text: str, job_roles: str = None) -> dict:
    """Use AI to screen the resume against job requirements."""
    global anthropic_client

    if not anthropic_client:
        init_anthropic()

    try:
        from .google_sheets import get_job_roles_from_sheets
        if job_roles is None:
            job_roles = get_job_roles_from_sheets()

        prompt = SCREENING_PROMPT.format(
            job_roles=job_roles,
            resume_text=resume_text[:15000]  # Limit resume text length
        )

        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = response.content[0].text

        # Try to parse JSON from response
        try:
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

        # Return basic structure if parsing fails
        return {
            "matched_job": "Unknown",
            "score": 5,
            "qualifications": [],
            "missing": [],
            "recommendation": "Review",
            "reason": response_text[:500],
            "raw_response": response_text
        }

    except Exception as e:
        print(f"Error screening resume: {e}")
        return {
            "error": str(e),
            "recommendation": "Review",
            "reason": "Screening failed - manual review required"
        }
