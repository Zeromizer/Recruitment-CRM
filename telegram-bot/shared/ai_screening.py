"""
AI screening and conversation handling using Claude.

This module handles:
- AI-powered conversation with candidates
- Resume screening and analysis
- Conversation state management
- Context-aware response generation

Uses the knowledgebase module for dynamic, objective-based responses.
"""

import os
import re
import json
from anthropic import Anthropic
from typing import Optional, Dict, List, Any

# Import knowledgebase for context-aware responses
from .knowledgebase import (
    RECRUITER_NAME,
    COMPANY_NAME,
    APPLICATION_FORM_URL,
    ROLE_KNOWLEDGE,
    ConversationContext,
    ConversationStage,
    build_system_prompt,
    build_context_from_state,
    identify_role_from_text,
    get_experience_question,
    get_first_contact_response,
    get_resume_acknowledgment,
)

# Import database functions for conversation persistence
from .database import (
    load_conversation_history,
    load_conversation_state,
    save_conversation_state,
    get_candidate_context_summary,
)

# Conversation memory (max 10 messages per user)
conversations: Dict[str, List[Dict[str, str]]] = {}
# Conversation state tracking for each user
conversation_states: Dict[str, Dict[str, Any]] = {}
# Conversation contexts for new system
conversation_contexts: Dict[str, ConversationContext] = {}
MAX_MESSAGES = 10


# Resume screening prompt (kept separate as it's a different task)
SCREENING_PROMPT = """You are analyzing a resume for a staffing agency. Your task is to evaluate the candidate.

AVAILABLE JOB ROLES:
{job_roles}

RESUME TEXT:
{resume_text}

INSTRUCTIONS:
1. Identify which job role the candidate is applying for based on context. Match to one of the available roles.
2. Analyze the resume against that role's requirements.
3. Extract contact information (email, phone) if visible.

CITIZENSHIP REQUIREMENT (CRITICAL):
Most roles require Singapore Citizens or Permanent Residents. Look for indicators:
- NRIC number (S/T = Citizen, F/G = PR)
- National Service (NS) completion
- Singapore address
- Local education (NUS, NTU, SMU, polytechnics, ITE)
- Explicit mention of citizenship/PR status

If no clear indicator of SC/PR status is found, set recommendation to "Rejected" unless the role specifically allows foreigners.

RESPONSE FORMAT:
Return ONLY a JSON object with no other text:
{{
    "candidate_name": "Full name from resume",
    "candidate_email": "email@example.com or null",
    "candidate_phone": "+65 XXXX XXXX or null",
    "job_applied": "Role from context if mentioned",
    "job_matched": "Best matching role from your list",
    "score": 7,
    "citizenship_status": "Singapore Citizen|PR|Unknown|Foreigner",
    "recommendation": "Top Candidate|Review|Rejected",
    "summary": "Brief evaluation including citizenship verification"
}}

Use the scoring guide for the matched role. Score 1-10."""

# Global client
anthropic_client: Optional[Anthropic] = None


def init_anthropic(api_key: str = None) -> Anthropic:
    """Initialize the Anthropic client."""
    global anthropic_client
    key = api_key or os.environ.get('CLAUDE_API_KEY')
    if not key:
        raise ValueError("CLAUDE_API_KEY not set")
    anthropic_client = Anthropic(api_key=key)
    return anthropic_client


# =============================================================================
# CONVERSATION MEMORY
# =============================================================================

def get_conversation(user_id: str) -> List[Dict[str, str]]:
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


def clear_conversation(user_id: str):
    """Clear conversation history for a user."""
    user_key = str(user_id)
    if user_key in conversations:
        conversations[user_key] = []
    if user_key in conversation_states:
        del conversation_states[user_key]
    if user_key in conversation_contexts:
        del conversation_contexts[user_key]


async def restore_conversation_from_db(
    user_id: str,
    platform: str = "whatsapp"
) -> bool:
    """
    Restore conversation history and state from database.

    Called when a user sends a message and we don't have them in memory.
    This enables conversation continuity after bot restarts.

    Args:
        user_id: The platform user ID
        platform: 'telegram' or 'whatsapp'

    Returns:
        True if history was restored, False if no history found
    """
    user_key = str(user_id)

    # Only restore if not already in memory
    if user_key in conversations and conversations[user_key]:
        return True

    # Try to load conversation history from database
    history = await load_conversation_history(platform, user_id)
    if history:
        conversations[user_key] = history[-MAX_MESSAGES * 2:]  # Keep last N messages
        print(f"Restored {len(conversations[user_key])} messages for {user_key}")

    # Try to load state from database
    db_state = await load_conversation_state(platform, user_id)
    if db_state:
        conversation_states[user_key] = db_state
        # Also sync to context
        conversation_contexts[user_key] = build_context_from_state(user_key, db_state)
        print(f"Restored state for {user_key}: {db_state.get('stage')}")
        return True

    return False


async def persist_conversation(
    user_id: str,
    platform: str = "whatsapp"
) -> bool:
    """
    Save current conversation state to database.

    Should be called after important events (resume received, etc.)
    to ensure conversation can be resumed after bot restarts.

    Args:
        user_id: The platform user ID
        platform: 'telegram' or 'whatsapp'

    Returns:
        True on success
    """
    user_key = str(user_id)

    history = conversations.get(user_key, [])
    state = conversation_states.get(user_key, {})

    if history or state:
        return await save_conversation_state(platform, user_id, history, state)

    return False


# =============================================================================
# CONVERSATION STATE MANAGEMENT
# =============================================================================

# State constants (kept for backward compatibility)
STATE_NEW = "new"
STATE_FORM_SENT = "form_sent"
STATE_FORM_COMPLETED = "form_completed"
STATE_RESUME_REQUESTED = "resume_requested"
STATE_RESUME_RECEIVED = "resume_received"
STATE_EXPERIENCE_ASKED = "experience_asked"
STATE_CALL_SCHEDULING = "call_scheduling"
STATE_CONVERSATION_CLOSED = "conversation_closed"


def get_conversation_state(user_id: str) -> Dict[str, Any]:
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
            "call_scheduled": False,
            "citizenship_status": None
        }
    return conversation_states[user_key]


def update_conversation_state(user_id: str, **kwargs) -> Dict[str, Any]:
    """Update the conversation state for a user."""
    state = get_conversation_state(user_id)
    state.update(kwargs)
    # Also update the context if it exists
    if str(user_id) in conversation_contexts:
        _sync_state_to_context(user_id)
    return state


def get_conversation_context(user_id: str) -> ConversationContext:
    """Get or create the conversation context for a user."""
    user_key = str(user_id)
    if user_key not in conversation_contexts:
        state = get_conversation_state(user_id)
        conversation_contexts[user_key] = build_context_from_state(user_key, state)
    return conversation_contexts[user_key]


def _sync_state_to_context(user_id: str):
    """Sync legacy state to new context system."""
    user_key = str(user_id)
    state = conversation_states.get(user_key, {})
    conversation_contexts[user_key] = build_context_from_state(user_key, state)


# =============================================================================
# STATE DETECTION FROM MESSAGES
# =============================================================================

def detect_state_from_message(user_id: str, message: str) -> Dict[str, Any]:
    """Detect and update conversation state based on user message content."""
    state = get_conversation_state(user_id)
    message_lower = message.lower()

    # Detect form completion
    form_completion_keywords = [
        "done", "completed", "finished", "filled", "submitted",
        "i've completed", "i have completed", "just completed",
        "form done", "already done", "already filled"
    ]
    if any(keyword in message_lower for keyword in form_completion_keywords):
        if not state["form_completed"]:
            update_conversation_state(user_id, form_completed=True, stage=STATE_FORM_COMPLETED)

    # Detect job role interest
    detected_role = identify_role_from_text(message)
    if detected_role and detected_role != "general":
        role_info = ROLE_KNOWLEDGE.get(detected_role, {})
        role_title = role_info.get("title", detected_role)
        update_conversation_state(user_id, applied_role=role_title)

    # Detect citizenship status mentions
    citizenship_indicators = {
        "singapore citizen": "SC",
        "singaporean": "SC",
        "sg citizen": "SC",
        "citizen": "SC",
        "permanent resident": "PR",
        "pr": "PR",
        "foreigner": "Foreign",
        "work permit": "Foreign",
        "student pass": "Foreign",
        "ep holder": "Foreign",
        "s pass": "Foreign"
    }
    for indicator, status in citizenship_indicators.items():
        if indicator in message_lower:
            update_conversation_state(user_id, citizenship_status=status)
            break

    # Detect availability/scheduling mentions
    time_patterns = ["pm", "am", "oclock", "o'clock", "available", "can make it", "free on"]
    if any(pattern in message_lower for pattern in time_patterns):
        if state.get('experience_discussed'):
            update_conversation_state(user_id, call_scheduled=True, stage=STATE_CALL_SCHEDULING)

    return state


# =============================================================================
# AI RESPONSE GENERATION
# =============================================================================

async def get_ai_response(
    user_id: str,
    message: str,
    candidate_name: str = None,
    platform: str = "whatsapp"
) -> str:
    """
    Get an AI response for a user message.

    This function:
    1. Restores conversation from database if needed (for continuity)
    2. Updates state based on message content
    3. Builds a dynamic context-aware prompt
    4. Generates a natural, objective-focused response

    Args:
        user_id: Platform user identifier
        message: User's message text
        candidate_name: Optional candidate name for personalization
        platform: 'telegram' or 'whatsapp' for DB operations
    """
    global anthropic_client

    if not anthropic_client:
        init_anthropic()

    # Try to restore conversation from database if not in memory
    # This enables continuity after bot restarts
    await restore_conversation_from_db(user_id, platform)

    # Handle empty messages
    if not message or not message.strip():
        message = "[Empty message]"

    # Update state based on message content
    detect_state_from_message(user_id, message)

    # Store candidate name if provided
    if candidate_name:
        update_conversation_state(user_id, candidate_name=candidate_name)

    # Add message to conversation history
    add_message(user_id, "user", message)

    # Get valid messages for context
    valid_messages = [
        msg for msg in get_conversation(user_id)
        if msg.get("content") and msg["content"].strip()
    ]

    # First message - generate initial contact response
    if not valid_messages or len(valid_messages) <= 1:
        state = get_conversation_state(user_id)
        update_conversation_state(user_id, stage=STATE_FORM_SENT)
        response = get_first_contact_response(candidate_name)
        add_message(user_id, "assistant", response)
        return response

    # Build dynamic system prompt based on current context
    context = get_conversation_context(user_id)
    system_prompt = build_system_prompt(context)

    try:
        response = anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=system_prompt,
            messages=valid_messages
        )
        ai_message = response.content[0].text
        add_message(user_id, "assistant", ai_message)

        # Update state based on response content
        _update_state_from_response(user_id, ai_message)

        return ai_message

    except Exception as e:
        print(f"Error getting AI response: {e}")
        return "sorry, having some trouble. could u try again?"


def _update_state_from_response(user_id: str, response: str):
    """Update conversation state based on what the AI response contains."""
    response_lower = response.lower()

    # Track if form link was sent
    if APPLICATION_FORM_URL.lower() in response_lower or "application form" in response_lower:
        update_conversation_state(user_id, stage=STATE_FORM_SENT)

    # Track if resume was requested
    if "resume" in response_lower and ("send" in response_lower or "have" in response_lower):
        state = get_conversation_state(user_id)
        if state.get("form_completed"):
            update_conversation_state(user_id, stage=STATE_RESUME_REQUESTED)

    # Track if experience question was asked
    experience_indicators = ["experience", "worked", "background", "skills"]
    if any(indicator in response_lower for indicator in experience_indicators):
        state = get_conversation_state(user_id)
        if state.get("resume_received"):
            update_conversation_state(user_id, experience_discussed=True, stage=STATE_EXPERIENCE_ASKED)

    # Track if conversation is closing
    closing_phrases = ["will contact", "shortlisted", "be in touch", "get back to u"]
    if any(phrase in response_lower for phrase in closing_phrases):
        update_conversation_state(user_id, stage=STATE_CONVERSATION_CLOSED)


# =============================================================================
# RESUME HANDLING
# =============================================================================

def mark_resume_received(
    user_id: str,
    applied_role: str = None,
    candidate_name: str = None,
    screening_summary: str = None
):
    """
    Mark that a resume has been received and add context to conversation.

    This is called after a resume is successfully processed.
    """
    update_conversation_state(
        user_id,
        resume_received=True,
        stage=STATE_RESUME_RECEIVED,
        applied_role=applied_role,
        candidate_name=candidate_name
    )

    # Build context about the resume for the AI
    resume_context = "[Candidate sent their resume]"
    if screening_summary:
        resume_context += f"\n[Resume summary: {screening_summary}]"
    if applied_role:
        resume_context += f"\n[Matched to role: {applied_role}]"

    # Add to conversation history so AI knows resume was received
    add_message(user_id, "user", resume_context)


def get_resume_response(
    user_id: str,
    candidate_name: str,
    matched_role: str = None,
    screening_summary: str = None
) -> str:
    """
    Generate a response after receiving and processing a resume.

    Uses the knowledgebase to generate a natural, role-appropriate response.
    """
    # Mark resume as received in state
    mark_resume_received(user_id, matched_role, candidate_name, screening_summary)

    # Identify role key for appropriate experience question
    role_key = identify_role_from_text(matched_role) if matched_role else None

    # Generate response
    response = get_resume_acknowledgment(candidate_name, role_key)

    # Add to conversation history
    add_message(user_id, "assistant", response)

    # Update state to mark experience as asked
    update_conversation_state(user_id, experience_discussed=True, stage=STATE_EXPERIENCE_ASKED)

    return response


# =============================================================================
# RESUME SCREENING
# =============================================================================

async def screen_resume(resume_text: str, job_roles: str = None) -> Dict[str, Any]:
    """
    Use AI to screen the resume against job requirements.

    Returns a structured screening result with:
    - candidate_name, candidate_email, candidate_phone
    - job_matched, score (1-10)
    - citizenship_status
    - recommendation (Top Candidate/Review/Rejected)
    - summary
    """
    global anthropic_client

    if not anthropic_client:
        init_anthropic()

    try:
        # Get job roles from Google Sheets if not provided
        if job_roles is None:
            try:
                from .google_sheets import get_job_roles_from_sheets
                job_roles = get_job_roles_from_sheets()
            except ImportError:
                job_roles = "No specific job roles configured. Screen generally."

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
                result = json.loads(json_match.group())
                # Validate required fields
                required_fields = ["candidate_name", "score", "recommendation"]
                if all(field in result for field in required_fields):
                    return result
        except json.JSONDecodeError:
            pass

        # Return basic structure if parsing fails
        return {
            "candidate_name": "Unknown",
            "candidate_email": None,
            "candidate_phone": None,
            "job_matched": "General",
            "score": 5,
            "citizenship_status": "Unknown",
            "recommendation": "Review",
            "summary": response_text[:500],
            "raw_response": response_text
        }

    except Exception as e:
        print(f"Error screening resume: {e}")
        return {
            "error": str(e),
            "candidate_name": "Unknown",
            "score": 0,
            "recommendation": "Review",
            "summary": "Screening failed - manual review required"
        }


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def get_state_summary(user_id: str) -> str:
    """Get a human-readable summary of the conversation state."""
    state = get_conversation_state(user_id)

    parts = []
    if state.get("candidate_name"):
        parts.append(f"Name: {state['candidate_name']}")
    if state.get("applied_role"):
        parts.append(f"Role: {state['applied_role']}")
    if state.get("citizenship_status"):
        parts.append(f"Citizenship: {state['citizenship_status']}")

    progress = []
    if state.get("form_completed"):
        progress.append("form")
    if state.get("resume_received"):
        progress.append("resume")
    if state.get("experience_discussed"):
        progress.append("experience")
    if progress:
        parts.append(f"Completed: {', '.join(progress)}")

    parts.append(f"Stage: {state.get('stage', 'unknown')}")

    return " | ".join(parts)


# Backward compatibility - kept for existing code that imports SYSTEM_PROMPT
def get_system_prompt(user_id: str = None) -> str:
    """
    Get the system prompt. If user_id is provided, returns a context-aware prompt.
    Otherwise returns a default prompt.
    """
    if user_id:
        context = get_conversation_context(user_id)
        return build_system_prompt(context)
    else:
        # Return default prompt for cases where user_id isn't available
        default_context = ConversationContext(user_id="default")
        return build_system_prompt(default_context)


# Legacy export for backward compatibility
SYSTEM_PROMPT = get_system_prompt()
