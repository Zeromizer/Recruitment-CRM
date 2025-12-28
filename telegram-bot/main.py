import os
import sys
import json
import asyncio
import random
import tempfile
import subprocess
import re
from io import BytesIO
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from anthropic import Anthropic
from supabase import create_client, Client
import PyPDF2
from docx import Document
import gspread
from google.oauth2.service_account import Credentials

# Conversation memory (max 10 messages per user)
conversations = {}
MAX_MESSAGES = 10

# Spam protection
import time
rate_limit_tracker = {}  # {user_id: [timestamp1, timestamp2, ...]}
RATE_LIMIT_MESSAGES = 10  # Max messages per time window
RATE_LIMIT_WINDOW = 60  # Time window in seconds (1 minute)

# Spam keywords to ignore (case-insensitive)
SPAM_KEYWORDS = [
    "crypto", "bitcoin", "ethereum", "investment opportunity",
    "make money fast", "work from home", "earn $", "earn usd",
    "click here", "free money", "lottery", "you have won",
    "nigerian prince", "wire transfer", "western union",
    "telegram premium", "free premium", "hack", "password"
]


def get_blocked_users() -> set:
    """Get set of blocked user IDs from environment variable."""
    blocked = os.environ.get('BLOCKED_TELEGRAM_USERS', '')
    if not blocked:
        return set()
    try:
        return set(int(uid.strip()) for uid in blocked.split(',') if uid.strip())
    except ValueError:
        return set()


def get_whitelist_users() -> set:
    """Get set of whitelisted user IDs (if whitelist mode is enabled)."""
    whitelist = os.environ.get('WHITELIST_TELEGRAM_USERS', '')
    if not whitelist:
        return set()
    try:
        return set(int(uid.strip()) for uid in whitelist.split(',') if uid.strip())
    except ValueError:
        return set()


def is_whitelist_mode() -> bool:
    """Check if whitelist mode is enabled."""
    return os.environ.get('TELEGRAM_WHITELIST_MODE', '').lower() in ('true', '1', 'yes')


def is_user_allowed(user_id: int) -> tuple[bool, str]:
    """Check if a user is allowed to interact with the bot.
    Returns (allowed, reason) tuple.
    """
    # Check blocked list
    if user_id in get_blocked_users():
        return False, "blocked"

    # Check whitelist mode
    if is_whitelist_mode():
        whitelist = get_whitelist_users()
        if whitelist and user_id not in whitelist:
            return False, "not_whitelisted"

    return True, "allowed"


def is_rate_limited(user_id: int) -> bool:
    """Check if user has exceeded rate limit."""
    current_time = time.time()

    if user_id not in rate_limit_tracker:
        rate_limit_tracker[user_id] = []

    # Remove old timestamps outside the window
    rate_limit_tracker[user_id] = [
        ts for ts in rate_limit_tracker[user_id]
        if current_time - ts < RATE_LIMIT_WINDOW
    ]

    # Check if over limit
    if len(rate_limit_tracker[user_id]) >= RATE_LIMIT_MESSAGES:
        return True

    # Add current timestamp
    rate_limit_tracker[user_id].append(current_time)
    return False


def contains_spam(text: str) -> bool:
    """Check if message contains spam keywords."""
    if not text:
        return False
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in SPAM_KEYWORDS)


async def check_spam_protection(event, user_id: int, username: str, text: str = "") -> bool:
    """Run all spam checks. Returns True if message should be ignored."""
    # Check if user is allowed
    allowed, reason = is_user_allowed(user_id)
    if not allowed:
        print(f"Blocked user {user_id} (@{username}): {reason}")
        return True

    # Check rate limit
    if is_rate_limited(user_id):
        print(f"Rate limited user {user_id} (@{username})")
        # Optionally send a warning (only once)
        if len(rate_limit_tracker.get(user_id, [])) == RATE_LIMIT_MESSAGES:
            await event.respond("You're sending messages too quickly. Please wait a moment.")
        return True

    # Check for spam content
    if contains_spam(text):
        print(f"Spam detected from {user_id} (@{username}): {text[:50]}...")
        return True

    return False

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


def extract_text_from_word(doc_bytes: bytes) -> str:
    """Extract text content from a Word document (.docx)."""
    try:
        doc = Document(BytesIO(doc_bytes))
        text_parts = []

        # Extract text from paragraphs
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                text_parts.append(paragraph.text)

        # Extract text from tables
        for table in doc.tables:
            for row in table.rows:
                row_text = []
                for cell in row.cells:
                    if cell.text.strip():
                        row_text.append(cell.text.strip())
                if row_text:
                    text_parts.append(" | ".join(row_text))

        return "\n".join(text_parts).strip()
    except Exception as e:
        print(f"Error extracting Word document text: {e}")
        return ""


def convert_word_to_pdf(doc_bytes: bytes) -> bytes:
    """Convert a Word document to PDF using LibreOffice."""
    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Write Word doc to temp file
            input_path = os.path.join(tmp_dir, "input.docx")
            with open(input_path, "wb") as f:
                f.write(doc_bytes)

            # Convert using LibreOffice
            subprocess.run([
                "libreoffice",
                "--headless",
                "--convert-to", "pdf",
                "--outdir", tmp_dir,
                input_path
            ], check=True, capture_output=True, timeout=60)

            # Read the converted PDF
            output_path = os.path.join(tmp_dir, "input.pdf")
            with open(output_path, "rb") as f:
                return f.read()
    except subprocess.TimeoutExpired:
        print("Error: Word to PDF conversion timed out")
        return None
    except Exception as e:
        print(f"Error converting Word to PDF: {e}")
        return None


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


async def send_telegram_messages(event, telegram_client, message: str):
    """Send message(s) - splits on '---' and adds realistic typing delays."""
    parts = [part.strip() for part in message.split('---') if part.strip()]

    for i, part in enumerate(parts):
        # Show typing action while "thinking" and "typing"
        async with telegram_client.action(event.chat_id, 'typing'):
            # Natural "thinking" delay: 3-6 seconds randomly
            thinking_delay = random.uniform(3.0, 6.0)
            # Typing delay: ~0.05s per character (simulates typing speed)
            typing_delay = len(part) * 0.05
            # Total delay, capped at 15 seconds
            total_delay = min(thinking_delay + typing_delay, 15.0)
            await asyncio.sleep(total_delay)
        await event.respond(part)

        # Add delay before next message (except for last one)
        if i < len(parts) - 1:
            # Natural "thinking" delay: 3-6 seconds randomly
            thinking_delay = random.uniform(3.0, 6.0)
            # Typing delay: ~0.05s per character (simulates typing speed)
            typing_delay = len(parts[i + 1]) * 0.05
            # Total delay, capped at 15 seconds
            total_delay = min(thinking_delay + typing_delay, 15.0)
            await asyncio.sleep(total_delay)


def setup_handlers(telegram_client):
    """Setup message handlers for the Telegram client."""

    @telegram_client.on(events.NewMessage(incoming=True))
    async def handle_message(event):
        # Skip if this is a file message (handled separately)
        if event.file:
            return

        # Only respond to private messages (ignore groups/channels)
        if not event.is_private:
            return

        sender = await event.get_sender()
        user_id = sender.id
        username = sender.username or ""
        full_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip()

        # Run spam protection checks
        if await check_spam_protection(event, user_id, username, event.text or ""):
            return

        print(f"Message from {full_name} (@{username}): {event.text}")
        async with telegram_client.action(event.chat_id, 'typing'):
            response = await get_ai_response(user_id, event.text or "")

        # Send response with message splitting and delays
        await send_telegram_messages(event, telegram_client, response)
        # Note: Only create candidate record when resume is received (not on text messages)

    @telegram_client.on(events.NewMessage(incoming=True, func=lambda e: e.file))
    async def handle_file(event):
        # Only respond to private messages (ignore groups/channels)
        if not event.is_private:
            return

        sender = await event.get_sender()
        user_id = sender.id
        username = sender.username or ""
        full_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip()

        # Run spam protection checks (no text for file messages)
        if await check_spam_protection(event, user_id, username):
            return

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
            await event.respond("thanks! will check it out")

            async with telegram_client.action(event.chat_id, 'typing'):
                # Download the file
                try:
                    file_bytes = await event.download_media(file=bytes)

                    if file_bytes:
                        # Extract text from resume and prepare for upload
                        upload_bytes = file_bytes
                        upload_name = file_name

                        if mime_type == "application/pdf" or file_name.lower().endswith('.pdf'):
                            resume_text = extract_text_from_pdf(file_bytes)
                        elif mime_type in ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] or file_name.lower().endswith(('.doc', '.docx')):
                            resume_text = extract_text_from_word(file_bytes)
                            # Convert Word to PDF for preview compatibility
                            pdf_bytes = convert_word_to_pdf(file_bytes)
                            if pdf_bytes:
                                upload_bytes = pdf_bytes
                                # Change extension to .pdf
                                upload_name = os.path.splitext(file_name)[0] + '.pdf'
                                print(f"Converted Word doc to PDF: {upload_name}")
                        else:
                            # For other document types, just note that it was received
                            resume_text = f"[Document received: {file_name}]"

                        if resume_text and len(resume_text) > 100:
                            print(f"Extracted {len(resume_text)} characters from resume")

                            # Screen the resume FIRST to get candidate name
                            screening_result = await screen_resume(resume_text)
                            print(f"Screening result: {screening_result.get('recommendation', 'Unknown')}")

                            # Get candidate name for file naming
                            candidate_name = screening_result.get('candidate_name', full_name or 'Unknown')

                            # Create filename with candidate name
                            safe_name = "".join(c for c in candidate_name if c.isalnum() or c in (' ', '-', '_')).strip()
                            safe_name = safe_name.replace(' ', '_') if safe_name else 'Unknown'
                            final_upload_name = f"{safe_name}_Resume.pdf"

                            # Upload resume to storage with candidate name
                            resume_url = await upload_resume_to_storage(upload_bytes, final_upload_name, user_id)

                            # Save candidate with screening results and resume URL
                            await save_candidate(user_id, username, full_name, screening_result, resume_url)

                            # Generate response in Ai Wei's style - ask role-specific questions
                            matched_job = screening_result.get('job_matched', 'our open positions')
                            first_name = candidate_name.split()[0] if candidate_name else 'there'

                            # Generate role-specific experience question
                            role_questions = {
                                "barista": "do u have experience making coffee with latte art?",
                                "coffee": "do u have experience making coffee with latte art?",
                                "researcher": "do u have experience with phone surveys or data collection?",
                                "phone": "do u have experience with phone surveys or data collection?",
                                "event": "do u have experience with events or customer service?",
                                "crew": "do u have experience working at events?",
                                "admin": "do u have experience with admin work?",
                                "customer service": "do u have experience in customer service?",
                                "promoter": "do u have experience with promotions or sales?",
                            }

                            # Find matching question based on job role
                            experience_question = None
                            matched_job_lower = matched_job.lower()
                            for keyword, question in role_questions.items():
                                if keyword in matched_job_lower:
                                    experience_question = question
                                    break

                            # Default question if no specific match
                            if not experience_question:
                                experience_question = "what relevant experience do u have for this role?"

                            response = f"thanks {first_name}!\n{experience_question}"
                            await event.respond(response)
                        else:
                            print("Could not extract sufficient text from resume")
                            await event.respond(
                                "thanks for ur resume! had a bit of trouble reading it but our team will review it manually. anything else i can help u with?"
                            )
                            # Note: Don't create candidate without successful resume processing
                    else:
                        print("Failed to download file")
                        await event.respond(
                            "had trouble downloading ur file. could u try sending it again?"
                        )
                except Exception as e:
                    print(f"Error processing file: {e}")
                    await event.respond(
                        "had some trouble processing ur file. our team will follow up with u. anything else i can help with?"
                    )
                    # Note: Don't create candidate on processing errors
        else:
            # Non-resume file - just respond, don't create candidate
            async with telegram_client.action(event.chat_id, 'typing'):
                response = await get_ai_response(user_id, f"[User sent a file: {file_name}]")
            await event.respond(response)


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
