"""Database operations for Supabase.

This module handles:
- Supabase client initialization
- Candidate CRUD operations
- Resume storage
- Conversation history persistence and retrieval
"""

import os
import json
import time
from typing import Optional, Dict, List, Any
from supabase import create_client, Client

# Global client
supabase_client: Client = None


def init_supabase(url: str = None, key: str = None) -> Client:
    """Initialize Supabase client."""
    global supabase_client

    supabase_url = url or os.environ.get('SUPABASE_URL')
    supabase_key = key or os.environ.get('SUPABASE_ANON_KEY')

    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

    supabase_client = create_client(supabase_url, supabase_key)
    return supabase_client


def get_supabase() -> Client:
    """Get or initialize Supabase client."""
    global supabase_client
    if not supabase_client:
        init_supabase()
    return supabase_client


async def upload_resume_to_storage(file_bytes: bytes, file_name: str, user_id: str) -> str:
    """Upload resume file to Supabase Storage and return the public URL."""
    client = get_supabase()

    try:
        # Create a unique filename
        timestamp = int(time.time())
        safe_name = file_name.replace(' ', '_')
        storage_path = f"resumes/{user_id}_{timestamp}_{safe_name}"

        # Upload to Supabase Storage
        client.storage.from_("resumes").upload(
            storage_path,
            file_bytes,
            {"content-type": "application/pdf"}
        )

        # Get public URL
        public_url = client.storage.from_("resumes").get_public_url(storage_path)
        print(f"Resume uploaded to: {public_url}")
        return public_url

    except Exception as e:
        print(f"Error uploading resume to storage: {e}")
        # Try creating the bucket if it doesn't exist
        try:
            client.storage.create_bucket("resumes", {"public": True})
            # Retry upload
            client.storage.from_("resumes").upload(
                storage_path,
                file_bytes,
                {"content-type": "application/pdf"}
            )
            public_url = client.storage.from_("resumes").get_public_url(storage_path)
            print(f"Resume uploaded to: {public_url}")
            return public_url
        except Exception as e2:
            print(f"Failed to create bucket and upload: {e2}")
            return None


async def save_candidate(
    user_id: str,
    username: str,
    full_name: str,
    source: str = "telegram",
    screening_result: dict = None,
    resume_url: str = None,
    conversation_history: list = None
):
    """Save or update candidate in database with optional screening results."""
    client = get_supabase()

    try:
        data = {
            "full_name": full_name or f"{source.title()} User {user_id}",
            "source": source,
        }

        # Set platform-specific user ID field
        if source == "telegram":
            data["telegram_user_id"] = int(user_id) if str(user_id).isdigit() else None
            data["telegram_username"] = username
        elif source == "whatsapp":
            data["whatsapp_phone"] = str(user_id)
            data["phone"] = str(user_id)  # Also set as primary phone

        # Add conversation history if provided
        if conversation_history:
            data["conversation_history"] = json.dumps(conversation_history)

        # Add screening results if available
        if screening_result:
            # Update name/email/phone if extracted from resume
            if screening_result.get("candidate_name"):
                data["full_name"] = screening_result["candidate_name"]
            if screening_result.get("candidate_email"):
                data["email"] = screening_result["candidate_email"]
            if screening_result.get("candidate_phone"):
                data["phone"] = screening_result["candidate_phone"]

            # Map recommendation to ai_category
            rec = screening_result.get("recommendation", "Review")
            if "Top" in rec:
                data["ai_category"] = "Top Candidate"
            elif "Reject" in rec:
                data["ai_category"] = "Rejected"
            else:
                data["ai_category"] = "Review"

            # Set current_status to ai_screened when resume is processed
            data["current_status"] = "ai_screened"

            # Add screening data
            data["applied_role"] = screening_result.get("job_matched", "")
            data["ai_score"] = screening_result.get("score", 0)
            data["ai_summary"] = screening_result.get("summary", "")

            # Add citizenship status - map to database format
            citizenship = screening_result.get("citizenship_status", "")
            if citizenship == "Singapore Citizen":
                data["citizenship_status"] = "SC"
            elif citizenship == "PR":
                data["citizenship_status"] = "PR"
            elif citizenship == "Foreigner":
                data["citizenship_status"] = "Foreign"
            else:
                data["citizenship_status"] = "Not Identified"

            # Store full screening result as JSON
            try:
                data["screening_result"] = json.dumps(screening_result)
            except:
                pass
        else:
            data["current_status"] = "new_application"

        # Add resume URL if provided
        if resume_url:
            data["resume_url"] = resume_url

        # Check for existing candidate based on source
        if source == "telegram" and data.get("telegram_user_id"):
            existing = client.table("candidates").select("id").eq("telegram_user_id", data["telegram_user_id"]).execute()
        elif source == "whatsapp" and data.get("whatsapp_phone"):
            existing = client.table("candidates").select("id").eq("whatsapp_phone", data["whatsapp_phone"]).execute()
        else:
            existing = None

        if existing and existing.data:
            if source == "telegram":
                client.table("candidates").update(data).eq("telegram_user_id", data["telegram_user_id"]).execute()
            elif source == "whatsapp":
                client.table("candidates").update(data).eq("whatsapp_phone", data["whatsapp_phone"]).execute()
            print(f"Updated candidate: {data['full_name']}")
        else:
            client.table("candidates").insert(data).execute()
            print(f"Created new candidate: {data['full_name']}")

        return True
    except Exception as e:
        print(f"Error saving candidate: {e}")
        return False


# =============================================================================
# CONVERSATION HISTORY RETRIEVAL
# =============================================================================

async def get_candidate_by_platform_id(
    platform: str,
    platform_id: str
) -> Optional[Dict[str, Any]]:
    """
    Get a candidate record by their platform-specific ID.

    Args:
        platform: 'telegram' or 'whatsapp'
        platform_id: The user ID (telegram_user_id or whatsapp_phone)

    Returns:
        Candidate record dict or None if not found
    """
    client = get_supabase()

    try:
        if platform == "telegram":
            # Telegram uses numeric user ID
            user_id = int(platform_id) if str(platform_id).isdigit() else None
            if user_id:
                result = client.table("candidates").select("*").eq("telegram_user_id", user_id).execute()
            else:
                return None
        elif platform == "whatsapp":
            result = client.table("candidates").select("*").eq("whatsapp_phone", str(platform_id)).execute()
        else:
            return None

        if result.data:
            return result.data[0]
        return None

    except Exception as e:
        print(f"Error getting candidate by platform ID: {e}")
        return None


async def load_conversation_history(
    platform: str,
    platform_id: str
) -> Optional[List[Dict[str, str]]]:
    """
    Load conversation history for a user from the database.

    This allows conversation continuity after bot restarts.

    Args:
        platform: 'telegram' or 'whatsapp'
        platform_id: The user ID

    Returns:
        List of conversation messages or None
    """
    candidate = await get_candidate_by_platform_id(platform, platform_id)

    if candidate and candidate.get("conversation_history"):
        try:
            history = json.loads(candidate["conversation_history"])
            if isinstance(history, list):
                print(f"Loaded {len(history)} messages from DB for {platform}:{platform_id}")
                return history
        except (json.JSONDecodeError, TypeError):
            pass

    return None


async def load_conversation_state(
    platform: str,
    platform_id: str
) -> Optional[Dict[str, Any]]:
    """
    Load conversation state from candidate record.

    Reconstructs state from stored fields like:
    - applied_role, ai_score, citizenship_status
    - resume_url (indicates resume received)
    - conversation_history

    Args:
        platform: 'telegram' or 'whatsapp'
        platform_id: The user ID

    Returns:
        Conversation state dict or None
    """
    candidate = await get_candidate_by_platform_id(platform, platform_id)

    if not candidate:
        return None

    # Reconstruct state from candidate record
    state = {
        "stage": "new",
        "applied_role": candidate.get("applied_role"),
        "candidate_name": candidate.get("full_name"),
        "resume_received": bool(candidate.get("resume_url")),
        "form_completed": False,  # Can't determine from DB, assume false
        "experience_discussed": False,
        "citizenship_status": candidate.get("citizenship_status"),
        "call_scheduled": False
    }

    # Infer form completion from having a record
    if candidate.get("ai_score") or candidate.get("resume_url"):
        state["form_completed"] = True
        state["stage"] = "form_completed"

    # Infer stage from available data
    if candidate.get("resume_url"):
        state["stage"] = "resume_received"
        state["resume_received"] = True

    # If they have an AI score, they've been screened
    if candidate.get("ai_score"):
        state["stage"] = "experience_asked"
        state["experience_discussed"] = True

    print(f"Loaded state from DB for {platform}:{platform_id}: {state.get('stage')}")
    return state


async def save_conversation_state(
    platform: str,
    platform_id: str,
    conversation_history: List[Dict[str, str]],
    state: Dict[str, Any] = None
) -> bool:
    """
    Save conversation history and optionally update state fields.

    This is called periodically or on important events to persist
    conversation progress.

    Args:
        platform: 'telegram' or 'whatsapp'
        platform_id: The user ID
        conversation_history: List of messages
        state: Optional conversation state to update

    Returns:
        True on success
    """
    client = get_supabase()

    try:
        data = {
            "conversation_history": json.dumps(conversation_history)
        }

        # Add state fields if provided
        if state:
            if state.get("applied_role"):
                data["applied_role"] = state["applied_role"]
            if state.get("candidate_name"):
                data["full_name"] = state["candidate_name"]

        # Update based on platform
        if platform == "telegram":
            user_id = int(platform_id) if str(platform_id).isdigit() else None
            if user_id:
                client.table("candidates").update(data).eq("telegram_user_id", user_id).execute()
        elif platform == "whatsapp":
            client.table("candidates").update(data).eq("whatsapp_phone", str(platform_id)).execute()

        return True

    except Exception as e:
        print(f"Error saving conversation state: {e}")
        return False


async def get_candidate_context_summary(
    platform: str,
    platform_id: str
) -> Optional[str]:
    """
    Get a summary of what we know about a returning candidate.

    This is useful for providing context to the AI when a conversation
    resumes after a break.

    Returns a human-readable summary string.
    """
    candidate = await get_candidate_by_platform_id(platform, platform_id)

    if not candidate:
        return None

    parts = []

    if candidate.get("full_name"):
        parts.append(f"Name: {candidate['full_name']}")

    if candidate.get("applied_role"):
        parts.append(f"Applied for: {candidate['applied_role']}")

    if candidate.get("citizenship_status"):
        status_map = {"SC": "Singapore Citizen", "PR": "Permanent Resident", "Foreign": "Foreigner"}
        status = status_map.get(candidate["citizenship_status"], candidate["citizenship_status"])
        parts.append(f"Citizenship: {status}")

    if candidate.get("resume_url"):
        parts.append("Resume: Received")

    if candidate.get("ai_score"):
        parts.append(f"AI Score: {candidate['ai_score']}/10")

    if candidate.get("ai_category"):
        parts.append(f"Category: {candidate['ai_category']}")

    if not parts:
        return None

    return " | ".join(parts)
