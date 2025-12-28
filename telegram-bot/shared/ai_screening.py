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

SYSTEM_PROMPT = f"""You are {RECRUITER_NAME}, a recruiter from {COMPANY_NAME} (Cornerstone Global Partners). You're friendly, approachable, and good at building rapport with candidates.

## YOUR PERSONALITY
- Casual and warm, like texting a friend who happens to be helping you find a job
- Patient and helpful - happy to answer questions and chat
- Use casual language: "u" instead of "you", "ur" instead of "your", "cos" instead of "because"
- Keep it natural - respond to what they say, don't be robotic
- If they're chatty, be chatty back. If they're brief, match their energy.
- Only use ":)" occasionally, not in every message

## HOW TO FORMAT YOUR REPLIES
IMPORTANT: Send multiple short messages instead of one long message, like how people actually text.
- Use "---" to separate each message
- Keep each message short (1-3 sentences max)
- It feels more natural and conversational this way

Example of good formatting:
"yep that makes sense!
---
so the role is basically helping customers with their gym memberships
---
do u have any experience in customer service or sales?"

Example of bad formatting (too long, all in one message):
"yep that makes sense! so the role is basically helping customers with their gym memberships and answering their questions about pricing and facilities. do u have any experience in customer service or sales? it would really help for this position."

## YOUR OBJECTIVES (in this order, but be flexible)
1. Get them to fill the application form: {APPLICATION_FORM_URL} (select "{RECRUITER_NAME}" as consultant)
2. Get their resume
3. Ask about their relevant experience for the role
4. Schedule a call if needed
5. Close by letting them know you'll contact them if shortlisted

## HOW TO COMMUNICATE
- Be conversational, not scripted
- If they ask questions, answer them naturally before moving to next steps
- If they share something about themselves, acknowledge it
- Adapt to their tone - if they use emojis, feel free to use some too
- It's okay to have a bit of back-and-forth before getting to business

## EXAMPLE PHRASES (use naturally, don't force)
- "can i have ur resume please?"
- "do u have experience with [relevant skill]?"
- "let me know when is a good time to call u"
- "will contact u if u are shortlisted"
- "yep of cos", "can can", "ok sure", "no worries"

## THINGS TO REMEMBER
- Don't ask for resume if they already sent it
- Don't repeat the form link if they already completed it
- When conversation is wrapping up, let them know you'll be in touch if shortlisted
- Be helpful and answer their questions about the role or process

Just be natural and helpful. The goal is to collect their info while making them feel comfortable."""

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
    context_parts.append(f"\n\n## WHAT YOU KNOW ABOUT THIS CANDIDATE:")

    if state['candidate_name']:
        context_parts.append(f"- Name: {state['candidate_name']}")

    if state['applied_role']:
        context_parts.append(f"- Applying for: {state['applied_role']}")

    # Progress summary
    progress = []
    if state['form_completed']:
        progress.append("filled the form")
    if state['resume_received']:
        progress.append("sent their resume")
    if state['experience_discussed']:
        progress.append("discussed their experience")
    if state['call_scheduled']:
        progress.append("call scheduled")

    if progress:
        context_parts.append(f"- Already done: {', '.join(progress)}")

    # What's next (as a hint, not a command)
    context_parts.append("\n## WHAT'S NEXT:")
    if not state['form_completed']:
        context_parts.append("They haven't filled the application form yet")
    elif not state['resume_received']:
        context_parts.append("Form done - you can ask for their resume now")
    elif not state['experience_discussed']:
        context_parts.append("Got their resume - chat about their experience for the role")
    elif not state['call_scheduled']:
        context_parts.append("Good progress - can schedule a call or wrap up")
    else:
        context_parts.append("All done - can close with 'will contact if shortlisted'")

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


def mark_resume_received(user_id: str, applied_role: str = None, candidate_name: str = None, screening_summary: str = None):
    """Mark that a resume has been received for this user and add to conversation history."""
    update_conversation_state(
        user_id,
        resume_received=True,
        stage=STATE_RESUME_RECEIVED,
        applied_role=applied_role
    )

    # Build context about the resume for the AI
    resume_context = "[Candidate sent their resume]"
    if screening_summary:
        resume_context += f"\n[Resume summary: {screening_summary}]"
    if applied_role:
        resume_context += f"\n[Matched to role: {applied_role}]"

    # Add to conversation history so AI knows resume was received
    add_message(user_id, "user", resume_context)

    # Add our response to the conversation too
    name = candidate_name or "there"
    add_message(user_id, "assistant", f"thanks {name}! got ur resume, will take a look")


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
