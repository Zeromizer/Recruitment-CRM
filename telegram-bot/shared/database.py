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

            # Add citizenship status - map to database format (handle variations from AI)
            raw_citizenship = (screening_result.get("citizenship_status", "") or "").lower().strip()

            if raw_citizenship in ("singapore citizen", "singaporean", "sc", "singapore citizens"):
                data["citizenship_status"] = "SC"
            elif raw_citizenship in ("pr", "permanent resident"):
                data["citizenship_status"] = "PR"
            elif raw_citizenship in ("foreigner", "foreign") or "pass holder" in raw_citizenship or "work permit" in raw_citizenship:
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


# =============================================================================
# NEW CONVERSATIONS TABLE OPERATIONS
# =============================================================================

async def save_message(
    platform: str,
    platform_user_id: str,
    role: str,
    content: str,
    metadata: dict = None
) -> bool:
    """
    Save a single message to the conversations table.

    Args:
        platform: 'telegram' or 'whatsapp'
        platform_user_id: The user's platform ID
        role: 'user' or 'assistant'
        content: The message content
        metadata: Optional metadata (file info, etc.)

    Returns:
        True on success
    """
    client = get_supabase()

    try:
        data = {
            "platform": platform,
            "platform_user_id": str(platform_user_id),
            "role": role,
            "content": content,
            "message_metadata": metadata or {}
        }

        client.table("conversations").insert(data).execute()
        return True

    except Exception as e:
        print(f"Error saving message: {e}")
        return False


async def get_conversation_messages(
    platform: str,
    platform_user_id: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Get conversation messages from the database.

    Args:
        platform: 'telegram' or 'whatsapp'
        platform_user_id: The user's platform ID
        limit: Maximum number of messages to return (most recent)

    Returns:
        List of message dicts with role, content, created_at
    """
    client = get_supabase()

    try:
        result = client.table("conversations").select(
            "role, content, created_at, message_metadata"
        ).eq(
            "platform", platform
        ).eq(
            "platform_user_id", str(platform_user_id)
        ).order(
            "created_at", desc=True
        ).limit(limit).execute()

        if result.data:
            # Reverse to get chronological order
            messages = list(reversed(result.data))
            return messages

        return []

    except Exception as e:
        print(f"Error getting conversation messages: {e}")
        return []


async def get_or_create_conversation_state(
    platform: str,
    platform_user_id: str
) -> Dict[str, Any]:
    """
    Get or create conversation state for a user.

    Returns the state dict with stage, flags, etc.
    """
    client = get_supabase()

    try:
        # Try to get existing state
        result = client.table("conversation_states").select("*").eq(
            "platform", platform
        ).eq(
            "platform_user_id", str(platform_user_id)
        ).execute()

        if result.data:
            state = result.data[0]
            return {
                "id": state.get("id"),
                "stage": state.get("stage", "initial"),
                "candidate_name": state.get("candidate_name"),
                "applied_role": state.get("applied_role"),
                "citizenship_status": state.get("citizenship_status"),
                "form_completed": state.get("form_completed", False),
                "resume_received": state.get("resume_received", False),
                "experience_discussed": state.get("experience_discussed", False),
                "call_scheduled": state.get("call_scheduled", False),
                "state_data": state.get("state_data", {}),
                "candidate_id": state.get("candidate_id"),
            }

        # Create new state
        data = {
            "platform": platform,
            "platform_user_id": str(platform_user_id),
            "stage": "initial",
            "form_completed": False,
            "resume_received": False,
            "experience_discussed": False,
            "call_scheduled": False,
            "state_data": {}
        }

        insert_result = client.table("conversation_states").insert(data).execute()

        if insert_result.data:
            return {**data, "id": insert_result.data[0].get("id")}

        return data

    except Exception as e:
        print(f"Error getting/creating conversation state: {e}")
        return {
            "stage": "initial",
            "form_completed": False,
            "resume_received": False,
            "experience_discussed": False,
            "call_scheduled": False,
        }


async def update_conversation_state_db(
    platform: str,
    platform_user_id: str,
    **updates
) -> bool:
    """
    Update conversation state fields in the database.

    Args:
        platform: 'telegram' or 'whatsapp'
        platform_user_id: The user's platform ID
        **updates: Fields to update (stage, candidate_name, etc.)

    Returns:
        True on success
    """
    client = get_supabase()

    try:
        # Build update data from kwargs
        allowed_fields = [
            "stage", "candidate_name", "applied_role", "citizenship_status",
            "form_completed", "resume_received", "experience_discussed",
            "call_scheduled", "candidate_id", "state_data"
        ]

        data = {k: v for k, v in updates.items() if k in allowed_fields}

        if not data:
            return True

        result = client.table("conversation_states").update(data).eq(
            "platform", platform
        ).eq(
            "platform_user_id", str(platform_user_id)
        ).execute()

        # Check if update matched any rows
        if not result.data:
            print(f"Warning: No conversation state found to update for {platform}/{platform_user_id}")
            # Try to create it instead (upsert behavior)
            create_data = {
                "platform": platform,
                "platform_user_id": str(platform_user_id),
                "stage": "initial",
                "form_completed": False,
                "resume_received": False,
                "experience_discussed": False,
                "call_scheduled": False,
                **data
            }
            client.table("conversation_states").insert(create_data).execute()
            print(f"Created new conversation state for {platform}/{platform_user_id}")

        return True

    except Exception as e:
        print(f"Error updating conversation state: {e}")
        return False


async def link_conversation_to_candidate(
    platform: str,
    platform_user_id: str,
    candidate_id: str
) -> bool:
    """
    Link all conversations and state to a candidate record.

    Called when a candidate is created/identified.
    """
    client = get_supabase()

    try:
        # Update conversations table
        client.table("conversations").update({
            "candidate_id": candidate_id
        }).eq(
            "platform", platform
        ).eq(
            "platform_user_id", str(platform_user_id)
        ).execute()

        # Update conversation_states table
        client.table("conversation_states").update({
            "candidate_id": candidate_id
        }).eq(
            "platform", platform
        ).eq(
            "platform_user_id", str(platform_user_id)
        ).execute()

        print(f"Linked conversations to candidate {candidate_id}")
        return True

    except Exception as e:
        print(f"Error linking conversation to candidate: {e}")
        return False


async def delete_conversation(
    platform: str,
    platform_user_id: str
) -> int:
    """
    Delete all conversation messages and state for a user.

    Returns the number of messages deleted.
    """
    client = get_supabase()

    try:
        # Delete messages
        result = client.table("conversations").delete().eq(
            "platform", platform
        ).eq(
            "platform_user_id", str(platform_user_id)
        ).execute()

        deleted_count = len(result.data) if result.data else 0

        # Delete state
        client.table("conversation_states").delete().eq(
            "platform", platform
        ).eq(
            "platform_user_id", str(platform_user_id)
        ).execute()

        print(f"Deleted {deleted_count} messages for {platform}:{platform_user_id}")
        return deleted_count

    except Exception as e:
        print(f"Error deleting conversation: {e}")
        return 0


async def get_all_conversations_summary() -> List[Dict[str, Any]]:
    """
    Get a summary of all conversations for CRM display.

    Returns list of conversation summaries with user info and message counts.
    """
    client = get_supabase()

    try:
        # Get all conversation states with candidate info
        result = client.table("conversation_states").select(
            "*, candidates(id, full_name, telegram_username, phone)"
        ).order("updated_at", desc=True).execute()

        summaries = []
        for state in result.data or []:
            # Get message count for this user
            msg_result = client.table("conversations").select(
                "id", count="exact"
            ).eq(
                "platform", state["platform"]
            ).eq(
                "platform_user_id", state["platform_user_id"]
            ).execute()

            candidate = state.get("candidates") or {}

            summaries.append({
                "platform": state["platform"],
                "platform_user_id": state["platform_user_id"],
                "candidate_id": state.get("candidate_id"),
                "candidate_name": candidate.get("full_name") or state.get("candidate_name") or "Unknown",
                "username": candidate.get("telegram_username"),
                "phone": candidate.get("phone"),
                "stage": state.get("stage", "initial"),
                "message_count": msg_result.count if msg_result else 0,
                "last_updated": state.get("updated_at"),
                "applied_role": state.get("applied_role"),
            })

        return summaries

    except Exception as e:
        print(f"Error getting conversations summary: {e}")
        return []
