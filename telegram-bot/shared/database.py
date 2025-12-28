"""Database operations for Supabase."""
import os
import json
import time
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
