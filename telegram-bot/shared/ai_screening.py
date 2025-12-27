"""AI screening and conversation handling using Claude."""
import os
import re
import json
from anthropic import Anthropic

# Conversation memory (max 10 messages per user)
conversations = {}
MAX_MESSAGES = 10

SYSTEM_PROMPT = """You are a friendly recruiter assistant helping to collect resumes from job candidates.
Your goal is to:
1. Greet candidates warmly and professionally
2. Ask them to share their resume (PDF or document)
3. Collect basic information: name, email, phone number, and position they're applying for
4. Be helpful and answer questions about the recruitment process
5. Keep responses concise and friendly

Always be professional but approachable. If they send a file, thank them for their resume."""

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


async def get_ai_response(user_id: str, message: str) -> str:
    """Get AI response for a user message."""
    global anthropic_client

    if not anthropic_client:
        init_anthropic()

    # Ensure message is not empty
    if not message or not message.strip():
        message = "[Empty message]"

    add_message(user_id, "user", message)

    # Filter out any empty messages from conversation history
    valid_messages = [
        msg for msg in get_conversation(user_id)
        if msg.get("content") and msg["content"].strip()
    ]

    if not valid_messages:
        return "Hello! I'm a recruiter assistant. How can I help you today?"

    try:
        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=valid_messages
        )
        ai_message = response.content[0].text
        add_message(user_id, "assistant", ai_message)
        return ai_message
    except Exception as e:
        print(f"Error getting AI response: {e}")
        return "I apologize, but I'm having trouble processing your message. Please try again."


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
