import os
import sys
import json
import asyncio
import tempfile
import re
from io import BytesIO
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from anthropic import Anthropic
from supabase import create_client, Client
import PyPDF2
import gspread
from google.oauth2.service_account import Credentials

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

# Global clients - initialized in main()
client = None
anthropic_client = None
supabase_client = None
gsheets_client = None
job_roles_cache = None
job_roles_cache_time = 0
JOB_ROLES_CACHE_DURATION = 300  # 5 minutes


def get_conversation(user_id: int) -> list:
    if user_id not in conversations:
        conversations[user_id] = []
    return conversations[user_id]


def add_message(user_id: int, role: str, content: str):
    conv = get_conversation(user_id)
    conv.append({"role": role, "content": content})
    if len(conv) > MAX_MESSAGES * 2:
        conv[:] = conv[-MAX_MESSAGES * 2:]


async def get_ai_response(user_id: int, message: str) -> str:
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


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text content from a PDF file."""
    try:
        pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_bytes))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""


def get_job_roles_from_sheets() -> str:
    """Fetch job roles from Google Sheets with caching."""
    global job_roles_cache, job_roles_cache_time, gsheets_client

    import time
    current_time = time.time()

    # Return cached data if still valid
    if job_roles_cache and (current_time - job_roles_cache_time) < JOB_ROLES_CACHE_DURATION:
        return job_roles_cache

    if not gsheets_client:
        print("Warning: Google Sheets not configured, using default job roles")
        return "No specific job roles configured. Screen the resume generally."

    try:
        spreadsheet_id = os.environ.get('GOOGLE_SHEETS_ID')
        if not spreadsheet_id:
            print("Warning: GOOGLE_SHEETS_ID not set")
            return "No specific job roles configured."

        sheet = gsheets_client.open_by_key(spreadsheet_id).sheet1
        records = sheet.get_all_records()

        job_roles_text = ""
        for row in records:
            job_title = row.get('Job Title', '')
            requirements = row.get('Requirements', '')
            scoring = row.get('Scoring Guide', '')
            if job_title:
                job_roles_text += f"\n\nJOB: {job_title}\nRequirements: {requirements}\nScoring: {scoring}"

        job_roles_cache = job_roles_text
        job_roles_cache_time = current_time
        print(f"Fetched {len(records)} job roles from Google Sheets")
        return job_roles_text

    except Exception as e:
        print(f"Error fetching job roles from Google Sheets: {e}")
        return job_roles_cache or "No specific job roles configured."


async def screen_resume(resume_text: str) -> dict:
    """Use AI to screen the resume against job requirements."""
    try:
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
            # Find JSON in response
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


async def upload_resume_to_storage(file_bytes: bytes, file_name: str, user_id: int) -> str:
    """Upload resume file to Supabase Storage and return the public URL."""
    try:
        import time
        # Create a unique filename
        timestamp = int(time.time())
        safe_name = file_name.replace(' ', '_')
        storage_path = f"resumes/{user_id}_{timestamp}_{safe_name}"

        # Upload to Supabase Storage
        result = supabase_client.storage.from_("resumes").upload(
            storage_path,
            file_bytes,
            {"content-type": "application/pdf"}
        )

        # Get public URL
        public_url = supabase_client.storage.from_("resumes").get_public_url(storage_path)
        print(f"Resume uploaded to: {public_url}")
        return public_url

    except Exception as e:
        print(f"Error uploading resume to storage: {e}")
        # Try creating the bucket if it doesn't exist
        try:
            supabase_client.storage.create_bucket("resumes", {"public": True})
            # Retry upload
            result = supabase_client.storage.from_("resumes").upload(
                storage_path,
                file_bytes,
                {"content-type": "application/pdf"}
            )
            public_url = supabase_client.storage.from_("resumes").get_public_url(storage_path)
            print(f"Resume uploaded to: {public_url}")
            return public_url
        except Exception as e2:
            print(f"Failed to create bucket and upload: {e2}")
            return None


async def save_candidate(user_id: int, username: str, full_name: str, screening_result: dict = None, resume_url: str = None):
    """Save or update candidate in database with optional screening results."""
    try:
        conv_history = get_conversation(user_id)

        data = {
            "full_name": full_name or f"Telegram User {user_id}",
            "telegram_user_id": user_id,
            "telegram_username": username,
            "source": "telegram",
            "conversation_history": json.dumps(conv_history)
        }

        # Add screening results if available
        if screening_result:
            # Update name/email/phone if extracted from resume
            if screening_result.get("candidate_name"):
                data["full_name"] = screening_result["candidate_name"]
            if screening_result.get("candidate_email"):
                data["email"] = screening_result["candidate_email"]
            if screening_result.get("candidate_phone"):
                data["phone"] = screening_result["candidate_phone"]

            # Map recommendation to status
            rec = screening_result.get("recommendation", "Review")
            if "Top" in rec:
                data["status"] = "Top Candidate"
            elif "Reject" in rec:
                data["status"] = "Rejected"
            else:
                data["status"] = "Review"

            # Add screening data
            data["applied_role"] = screening_result.get("job_matched", "")
            data["ai_score"] = screening_result.get("score", 0)
            data["ai_summary"] = screening_result.get("summary", "")

            # Add citizenship status if column exists
            if screening_result.get("citizenship_status"):
                data["citizenship_status"] = screening_result["citizenship_status"]

            # Store full screening result as JSON if column exists
            try:
                data["screening_result"] = json.dumps(screening_result)
            except:
                pass
        else:
            data["status"] = "new"

        # Add resume URL if provided
        if resume_url:
            data["resume_url"] = resume_url

        existing = supabase_client.table("candidates").select("id").eq("telegram_user_id", user_id).execute()
        if existing.data:
            supabase_client.table("candidates").update(data).eq("telegram_user_id", user_id).execute()
            print(f"Updated candidate: {data['full_name']}")
        else:
            supabase_client.table("candidates").insert(data).execute()
            print(f"Created new candidate: {data['full_name']}")

        return True
    except Exception as e:
        print(f"Error saving candidate: {e}")
        return False


def validate_env_vars():
    """Validate all required environment variables are set."""
    required = {
        'TELEGRAM_API_ID': os.environ.get('TELEGRAM_API_ID'),
        'TELEGRAM_API_HASH': os.environ.get('TELEGRAM_API_HASH'),
        'TELEGRAM_SESSION_STRING': os.environ.get('TELEGRAM_SESSION_STRING'),
        'CLAUDE_API_KEY': os.environ.get('CLAUDE_API_KEY'),
        'SUPABASE_URL': os.environ.get('SUPABASE_URL'),
        'SUPABASE_ANON_KEY': os.environ.get('SUPABASE_ANON_KEY'),
    }

    missing = [key for key, value in required.items() if not value]

    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}")
        return False

    # Validate API_ID is a number
    try:
        int(required['TELEGRAM_API_ID'])
    except ValueError:
        print(f"ERROR: TELEGRAM_API_ID must be a number, got: {required['TELEGRAM_API_ID']}")
        return False

    # Check optional Google Sheets config
    if not os.environ.get('GOOGLE_SHEETS_CREDENTIALS'):
        print("Warning: GOOGLE_SHEETS_CREDENTIALS not set - resume screening will use basic mode")
    if not os.environ.get('GOOGLE_SHEETS_ID'):
        print("Warning: GOOGLE_SHEETS_ID not set - resume screening will use basic mode")

    return True


def init_google_sheets():
    """Initialize Google Sheets client."""
    global gsheets_client

    creds_json = os.environ.get('GOOGLE_SHEETS_CREDENTIALS')
    if not creds_json:
        print("Google Sheets credentials not configured")
        return None

    try:
        creds_dict = json.loads(creds_json)
        scopes = [
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/drive.readonly'
        ]
        credentials = Credentials.from_service_account_info(creds_dict, scopes=scopes)
        gsheets_client = gspread.authorize(credentials)
        print("Google Sheets client initialized")
        return gsheets_client
    except Exception as e:
        print(f"Error initializing Google Sheets: {e}")
        return None


def setup_handlers(telegram_client):
    """Setup message handlers for the Telegram client."""

    @telegram_client.on(events.NewMessage(incoming=True))
    async def handle_message(event):
        # Skip if this is a file message (handled separately)
        if event.file:
            return

        if event.is_private:
            sender = await event.get_sender()
            user_id = sender.id
            username = sender.username or ""
            full_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip()
            print(f"Message from {full_name} (@{username}): {event.text}")
            async with telegram_client.action(event.chat_id, 'typing'):
                response = await get_ai_response(user_id, event.text or "")
            await event.respond(response)
            await save_candidate(user_id, username, full_name)

    @telegram_client.on(events.NewMessage(incoming=True, func=lambda e: e.file))
    async def handle_file(event):
        if event.is_private:
            sender = await event.get_sender()
            user_id = sender.id
            username = sender.username or ""
            full_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip()

            # Get file info
            file_name = event.file.name or "unknown"
            file_size = event.file.size or 0
            mime_type = event.file.mime_type or ""

            print(f"File received from {full_name} (@{username}): {file_name} ({mime_type}, {file_size} bytes)")

            # Check if it's a PDF or document
            is_resume = (
                mime_type == "application/pdf" or
                file_name.lower().endswith('.pdf') or
                mime_type in ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] or
                file_name.lower().endswith(('.doc', '.docx'))
            )

            if is_resume:
                await event.respond("Thank you for your resume! I'm processing it now... 📄")

                async with telegram_client.action(event.chat_id, 'typing'):
                    # Download the file
                    try:
                        file_bytes = await event.download_media(file=bytes)

                        if file_bytes:
                            # Extract text from PDF
                            if mime_type == "application/pdf" or file_name.lower().endswith('.pdf'):
                                resume_text = extract_text_from_pdf(file_bytes)
                            else:
                                # For non-PDF, just note that it was received
                                resume_text = f"[Document received: {file_name}]"

                            if resume_text and len(resume_text) > 100:
                                print(f"Extracted {len(resume_text)} characters from resume")

                                # Upload resume to storage
                                resume_url = await upload_resume_to_storage(file_bytes, file_name, user_id)

                                # Screen the resume
                                screening_result = await screen_resume(resume_text)
                                print(f"Screening result: {screening_result.get('recommendation', 'Unknown')}")

                                # Save candidate with screening results and resume URL
                                await save_candidate(user_id, username, full_name, screening_result, resume_url)

                                # Generate response based on screening
                                score = screening_result.get('score', 0)
                                matched_job = screening_result.get('job_matched', 'our open positions')

                                response = f"""Thank you for submitting your resume, {full_name or 'candidate'}!

I've reviewed your application and found you could be a great fit for **{matched_job}**.

Our recruitment team will review your profile and get back to you soon. In the meantime, is there anything specific about the role you'd like to know?"""

                                await event.respond(response)
                            else:
                                print("Could not extract sufficient text from resume")
                                await event.respond(
                                    "Thank you for your resume! I received the file but had trouble reading its contents. "
                                    "Our team will review it manually. Is there anything else I can help you with?"
                                )
                                await save_candidate(user_id, username, full_name)
                        else:
                            print("Failed to download file")
                            await event.respond(
                                "I had trouble downloading your file. Could you please try sending it again?"
                            )
                    except Exception as e:
                        print(f"Error processing file: {e}")
                        await event.respond(
                            "I encountered an error processing your file. Our team will follow up with you. "
                            "Is there anything else I can help with?"
                        )
                        await save_candidate(user_id, username, full_name)
            else:
                # Non-resume file
                async with telegram_client.action(event.chat_id, 'typing'):
                    response = await get_ai_response(user_id, f"[User sent a file: {file_name}]")
                await event.respond(response)
                await save_candidate(user_id, username, full_name)


async def main():
    global client, anthropic_client, supabase_client

    print("=" * 50)
    print("Telegram Bot Starting...")
    print("=" * 50)

    # Validate environment variables
    print("Checking environment variables...")
    if not validate_env_vars():
        sys.exit(1)
    print("Environment variables OK")

    # Get environment variables
    api_id = int(os.environ.get('TELEGRAM_API_ID'))
    api_hash = os.environ.get('TELEGRAM_API_HASH')
    session_string = os.environ.get('TELEGRAM_SESSION_STRING')
    claude_api_key = os.environ.get('CLAUDE_API_KEY')
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_ANON_KEY')

    # Initialize Anthropic client
    print("Initializing Anthropic client...")
    try:
        anthropic_client = Anthropic(api_key=claude_api_key)
        print("Anthropic client OK")
    except Exception as e:
        print(f"ERROR: Failed to initialize Anthropic client: {e}")
        sys.exit(1)

    # Initialize Supabase client
    print("Initializing Supabase client...")
    try:
        supabase_client = create_client(supabase_url, supabase_key)
        print("Supabase client OK")
    except Exception as e:
        print(f"ERROR: Failed to initialize Supabase client: {e}")
        sys.exit(1)

    # Initialize Google Sheets client (optional)
    print("Initializing Google Sheets client...")
    init_google_sheets()

    # Initialize Telegram client
    print("Initializing Telegram client...")
    print(f"  API ID: {api_id}")
    print(f"  Session string length: {len(session_string)} chars")

    try:
        client = TelegramClient(
            StringSession(session_string),
            api_id,
            api_hash,
            connection_retries=3,
            retry_delay=1
        )
        print("Telegram client created")
    except Exception as e:
        print(f"ERROR: Failed to create Telegram client: {e}")
        sys.exit(1)

    # Setup message handlers
    print("Setting up message handlers...")
    setup_handlers(client)
    print("Handlers OK")

    # Connect to Telegram
    print("Connecting to Telegram...")
    try:
        await asyncio.wait_for(client.connect(), timeout=30)
        print("Connected to Telegram")
    except asyncio.TimeoutError:
        print("ERROR: Connection to Telegram timed out after 30 seconds")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: Failed to connect to Telegram: {e}")
        sys.exit(1)

    # Check authorization
    print("Checking authorization...")
    try:
        if not await client.is_user_authorized():
            print("ERROR: Session is not authorized. Please regenerate your session string.")
            sys.exit(1)
        print("Authorization OK")
    except Exception as e:
        print(f"ERROR: Authorization check failed: {e}")
        sys.exit(1)

    # Get user info
    try:
        me = await client.get_me()
        print(f"Logged in as: {me.first_name} (@{me.username})")
    except Exception as e:
        print(f"Warning: Could not get user info: {e}")

    print("=" * 50)
    print("Bot is running! Waiting for messages...")
    print("=" * 50)

    await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())
