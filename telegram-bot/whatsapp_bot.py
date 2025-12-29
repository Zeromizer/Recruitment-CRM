"""
WhatsApp Bot using Walichat API
Handles incoming messages via webhooks and sends responses via Walichat REST API.
"""
import os
import sys
import asyncio
import random
import re
from datetime import datetime, time
from zoneinfo import ZoneInfo
import httpx
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

# Add parent directory to path for shared imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from shared.ai_screening import get_ai_response, screen_resume, init_anthropic, get_conversation, mark_resume_received, update_conversation_state
from shared.database import save_candidate, upload_resume_to_storage, init_supabase
from shared.resume_parser import extract_text_from_pdf, extract_text_from_pdf_with_vision, extract_text_from_word, convert_word_to_pdf
from shared.google_sheets import init_google_sheets
from shared.spam_protection import is_rate_limited, contains_spam, is_user_allowed

# Walichat API configuration
WALICHAT_API_BASE = "https://api.wali.chat/v1"
WALICHAT_API_TOKEN = os.environ.get('WALICHAT_API_TOKEN')
WALICHAT_DEVICE_ID = os.environ.get('WALICHAT_DEVICE_ID')

# Bot activation state tracking
# Numbers where bot is actively responding
bot_active_numbers = set()
# Numbers where bot has been manually stopped
bot_stopped_numbers = set()

# Configuration for the recruiter
RECRUITER_NAME = os.environ.get('RECRUITER_NAME', 'Ai Wei')
COMPANY_NAME = os.environ.get('COMPANY_NAME', 'CGP')
APPLICATION_FORM_URL = os.environ.get('APPLICATION_FORM_URL', 'Shorturl.at/kmvJ6')

# Global bot enable/disable switch
# Set WHATSAPP_BOT_ENABLED=false in environment to disable bot
BOT_ENABLED = os.environ.get('WHATSAPP_BOT_ENABLED', 'true').lower() in ('true', '1', 'yes')

# First reply template when bot is activated
# Uses '---' delimiter to split into multiple messages with natural delays
FIRST_REPLY_TEMPLATE = f"""Hello, I am {RECRUITER_NAME} from {COMPANY_NAME}. Could you kindly fill up the Application Form here: {APPLICATION_FORM_URL}

Consultant Name is {RECRUITER_NAME} (Pls find the dropdown list of my name)

As soon as you are finished, please let me know. Thank you!---The application form link is currently down. You can send me your resume first and I will ask you to fill the application form once its ready."""

# Keywords that trigger bot activation on first message
JOB_KEYWORDS = [
    "job", "jobs", "apply", "applying", "role", "roles", "position", "positions",
    "hiring", "vacancy", "vacancies", "work", "working", "resume", "cv",
    "interested", "interest", "opportunity", "opportunities", "opening", "openings",
    "recruit", "employment", "career", "part time", "part-time", "full time", "full-time",
    "internship", "intern", "looking for", "available", "joining"
]

# Stop command pattern
STOP_COMMAND = "//stop"

# Closing phrases that trigger auto-stop
CLOSING_PHRASES = [
    "will contact u if shortlisted",
    "will contact you if shortlisted",
    "contact u if shortlisted",
    "contact you if shortlisted"
]

# Operating hours configuration (Singapore timezone)
TIMEZONE = ZoneInfo("Asia/Singapore")
OPERATING_START = time(8, 30)  # 8:30 AM
OPERATING_END = time(22, 0)    # 10:00 PM


def is_within_operating_hours() -> bool:
    """Check if current time is within operating hours (8:30 AM - 10:00 PM Singapore time)."""
    now = datetime.now(TIMEZONE)
    current_time = now.time()
    return OPERATING_START <= current_time <= OPERATING_END


def contains_job_keyword(text: str) -> bool:
    """Check if message contains job-related keywords."""
    if not text:
        return False
    text_lower = text.lower()
    # Use word boundaries to avoid false positives
    for keyword in JOB_KEYWORDS:
        # Check for keyword as a whole word
        if re.search(r'\b' + re.escape(keyword) + r'\b', text_lower):
            return True
    return False


def is_first_message(phone: str) -> bool:
    """Check if this is the first message from this phone number."""
    conversation = get_conversation(phone)
    return len(conversation) == 0


def is_saved_contact(contact: dict) -> bool:
    """
    Check if sender is a saved contact.
    Saved contacts have 'name' or 'shortName' fields.
    Note: 'pushName' exists for everyone (WhatsApp profile name), so we don't use it.
    """
    return bool(contact.get("name") or contact.get("shortName"))


def should_bot_respond(phone: str, text: str, contact: dict = None) -> tuple[bool, str]:
    """
    Determine if bot should respond to this message.
    Returns (should_respond, reason).
    """
    # Check if manually stopped
    if phone in bot_stopped_numbers:
        return False, "manually_stopped"

    # Check if already active
    if phone in bot_active_numbers:
        return True, "already_active"

    # Check if sender is a saved contact - don't activate for contacts
    if contact and is_saved_contact(contact):
        return False, "saved_contact"

    # First message - check for keywords
    if is_first_message(phone):
        if contains_job_keyword(text):
            return True, "keyword_match"
        else:
            return False, "no_keyword"

    # Not first message and not active - don't respond
    return False, "not_active"


def activate_bot(phone: str):
    """Activate bot for this phone number."""
    bot_active_numbers.add(phone)
    bot_stopped_numbers.discard(phone)
    print(f"Bot activated for {phone}")


def deactivate_bot(phone: str, reason: str = "manual"):
    """Deactivate bot for this phone number."""
    bot_active_numbers.discard(phone)
    if reason == "manual":
        bot_stopped_numbers.add(phone)
    print(f"Bot deactivated for {phone} (reason: {reason})")


def check_for_closing(response: str) -> bool:
    """Check if response contains a closing phrase."""
    response_lower = response.lower()
    return any(phrase in response_lower for phrase in CLOSING_PHRASES)


# Debug: print device ID at module load
print(f"WALICHAT_DEVICE_ID loaded: '{WALICHAT_DEVICE_ID}' (length: {len(WALICHAT_DEVICE_ID) if WALICHAT_DEVICE_ID else 0})")

# HTTP client for Walichat API
http_client: httpx.AsyncClient = None


def validate_env_vars():
    """Validate all required environment variables are set."""
    required = {
        'WALICHAT_API_TOKEN': os.environ.get('WALICHAT_API_TOKEN'),
        'WALICHAT_DEVICE_ID': os.environ.get('WALICHAT_DEVICE_ID'),
        'CLAUDE_API_KEY': os.environ.get('CLAUDE_API_KEY'),
        'SUPABASE_URL': os.environ.get('SUPABASE_URL'),
        'SUPABASE_ANON_KEY': os.environ.get('SUPABASE_ANON_KEY'),
    }

    missing = [key for key, value in required.items() if not value]

    if missing:
        print(f"ERROR: Missing required environment variables: {', '.join(missing)}")
        return False

    # Check optional Google Sheets config
    if not os.environ.get('GOOGLE_SHEETS_CREDENTIALS'):
        print("Warning: GOOGLE_SHEETS_CREDENTIALS not set - resume screening will use basic mode")
    if not os.environ.get('GOOGLE_SHEETS_ID'):
        print("Warning: GOOGLE_SHEETS_ID not set - resume screening will use basic mode")

    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager - initialize clients on startup."""
    global http_client

    print("=" * 50)
    print("WhatsApp Bot Starting...")
    print(f"Bot Status: {'ENABLED' if BOT_ENABLED else 'DISABLED'}")
    print("=" * 50)

    # Validate environment variables
    print("Checking environment variables...")
    if not validate_env_vars():
        sys.exit(1)
    print("Environment variables OK")

    # Initialize Anthropic client
    print("Initializing Anthropic client...")
    try:
        init_anthropic()
        print("Anthropic client OK")
    except Exception as e:
        print(f"ERROR: Failed to initialize Anthropic client: {e}")
        sys.exit(1)

    # Initialize Supabase client
    print("Initializing Supabase client...")
    try:
        init_supabase()
        print("Supabase client OK")
    except Exception as e:
        print(f"ERROR: Failed to initialize Supabase client: {e}")
        sys.exit(1)

    # Initialize Google Sheets client (optional)
    print("Initializing Google Sheets client...")
    init_google_sheets()

    # Initialize HTTP client for Walichat API
    print("Initializing Walichat HTTP client...")
    http_client = httpx.AsyncClient(
        base_url=WALICHAT_API_BASE,
        headers={
            "Token": WALICHAT_API_TOKEN,
            "Content-Type": "application/json"
        },
        timeout=30.0
    )
    print("Walichat client OK")

    print("=" * 50)
    print("WhatsApp Bot is running! Waiting for webhooks...")
    print("=" * 50)

    yield

    # Cleanup on shutdown
    await http_client.aclose()
    print("WhatsApp Bot shutdown complete")


app = FastAPI(
    title="WhatsApp Recruitment Bot",
    description="WhatsApp bot for candidate recruitment using Walichat API",
    lifespan=lifespan
)


async def send_single_message(phone: str, message: str) -> bool:
    """Send a single WhatsApp message via Walichat API."""
    try:
        clean_phone = phone.strip()
        payload = {
            "phone": clean_phone,
            "message": message,
            "device": WALICHAT_DEVICE_ID,
        }

        response = await http_client.post("/messages", json=payload)

        if response.status_code == 200 or response.status_code == 201:
            print(f"Message sent to {clean_phone}: {message[:50]}...")
            return True
        else:
            print(f"Failed to send message: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"Error sending WhatsApp message: {e}")
        return False


async def send_whatsapp_message(phone: str, message: str) -> bool:
    """Send WhatsApp message(s) - splits on '---' and adds realistic typing delays."""
    # Split message on '---' delimiter
    parts = [part.strip() for part in message.split('---') if part.strip()]

    if len(parts) <= 1:
        # Single message, send normally
        return await send_single_message(phone, message)

    # Multiple messages - send with delays
    for i, part in enumerate(parts):
        success = await send_single_message(phone, part)
        if not success:
            return False

        # Small buffer to ensure message is delivered before sending next
        await asyncio.sleep(1.5)

        # Add delay before next message (except for last one)
        if i < len(parts) - 1:
            # Natural "thinking" delay: 3-6 seconds randomly
            thinking_delay = random.uniform(3.0, 6.0)
            # Typing delay: ~0.05s per character (simulates typing speed)
            typing_delay = len(parts[i + 1]) * 0.05
            # Total delay, capped at 15 seconds
            total_delay = min(thinking_delay + typing_delay, 15.0)
            await asyncio.sleep(total_delay)

    return True


async def download_media(media_url: str, file_id: str = None, message_id: str = None) -> bytes:
    """Download media file from Walichat."""
    # Primary method: Use file ID with /chat/{device}/files/{id}/download endpoint
    if file_id:
        try:
            api_url = f"/chat/{WALICHAT_DEVICE_ID}/files/{file_id}/download"
            response = await http_client.get(api_url)
            if response.status_code == 200:
                print(f"Downloaded file ({len(response.content)} bytes)")
                return response.content
        except Exception as e:
            print(f"Download error: {e}")

    # Fallback: Direct URL download
    if media_url:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(media_url)
                if response.status_code == 200:
                    return response.content
        except Exception as e:
            print(f"Direct download error: {e}")

    print("Failed to download media")
    return None


async def process_text_message(phone: str, name: str, text: str, contact: dict = None):
    """Process a text message from WhatsApp."""

    # Check if bot is globally disabled
    if not BOT_ENABLED:
        print(f"Bot is disabled globally - not responding to {phone}")
        return

    # Check for stop command first (from recruiter taking over) - works anytime
    if text.strip().lower() == STOP_COMMAND.lower():
        deactivate_bot(phone, reason="manual")
        print(f"Bot stopped for {phone} via //stop command")
        return  # Don't send any response for stop command

    # Check operating hours (8:30 AM - 10:00 PM Singapore time)
    if not is_within_operating_hours():
        print(f"Outside operating hours - not responding to {phone}")
        return

    # Check spam protection
    allowed, reason = is_user_allowed(phone)
    if not allowed:
        return

    if is_rate_limited(phone):
        await send_whatsapp_message(phone, "You're sending messages too quickly. Please wait a moment.")
        return

    if contains_spam(text):
        return

    # Check if bot should respond to this message
    should_respond, respond_reason = should_bot_respond(phone, text, contact)

    if not should_respond:
        print(f"Bot not responding to {phone}: {respond_reason}")
        return

    # Activate bot if this is a new keyword-triggered conversation
    if respond_reason == "keyword_match":
        activate_bot(phone)
        # Send the first reply template (contains '---' delimiter for sequential messages)
        await send_whatsapp_message(phone, FIRST_REPLY_TEMPLATE)
        return

    # Get AI response with candidate name for personalization
    response = await get_ai_response(phone, text, candidate_name=name)
    await send_whatsapp_message(phone, response)

    # Check if this is a closing message - auto-stop bot
    if check_for_closing(response):
        deactivate_bot(phone, reason="closing")
        print(f"Bot auto-stopped for {phone} after closing message")

    # Note: Only create candidate record when resume is received (not on text messages)


async def process_document_message(phone: str, name: str, file_name: str, media_url: str, mime_type: str, message_id: str = "", file_id: str = "", contact: dict = None):
    """Process a document message (resume) from WhatsApp."""
    # Check if bot is globally disabled
    if not BOT_ENABLED:
        print(f"Bot is disabled globally - not responding to document from {phone}")
        return

    # Check operating hours (8:30 AM - 10:00 PM Singapore time)
    if not is_within_operating_hours():
        print(f"Outside operating hours - not responding to document from {phone}")
        return

    # Check if bot was manually stopped
    if phone in bot_stopped_numbers:
        print(f"Bot not responding to document from {phone}: manually_stopped")
        return

    # Check spam protection
    allowed, reason = is_user_allowed(phone)
    if not allowed:
        return

    # Check if it's a resume
    is_resume = (
        mime_type == "application/pdf" or
        file_name.lower().endswith('.pdf') or
        mime_type in ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] or
        file_name.lower().endswith(('.doc', '.docx'))
    )

    if is_resume:
        # Check if sender is a saved contact - don't activate for contacts
        if contact and is_saved_contact(contact):
            print(f"Not activating bot for saved contact: {phone}")
            return

        # Resume = strong intent signal, activate bot if not already active
        if phone not in bot_active_numbers:
            activate_bot(phone)

        await send_whatsapp_message(phone, "thanks! will check it out")

        # Download the file - try with file ID first, then message ID, then direct URL
        file_bytes = await download_media(media_url, file_id, message_id)

        if file_bytes:
            # Extract text from resume and prepare for upload
            upload_bytes = file_bytes
            upload_name = file_name

            if mime_type == "application/pdf" or file_name.lower().endswith('.pdf'):
                resume_text = extract_text_from_pdf(file_bytes)
                # If PyPDF2 extraction failed (image-based PDF like Canva), use Claude vision
                if not resume_text or len(resume_text) < 100:
                    print(f"PyPDF2 extracted only {len(resume_text)} chars, trying vision API fallback...")
                    resume_text = await extract_text_from_pdf_with_vision(file_bytes)
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
                resume_text = f"[Document received: {file_name}]"

            if resume_text and len(resume_text) > 100:
                # Screen the resume FIRST to get candidate name
                screening_result = await screen_resume(resume_text)
                print(f"Resume processed: {screening_result.get('candidate_name', 'Unknown')} - {screening_result.get('recommendation', 'Unknown')}")

                # Extract candidate info
                matched_job = screening_result.get('job_matched', 'our open positions')
                candidate_name = screening_result.get('candidate_name', name or 'there')
                first_name = candidate_name.split()[0] if candidate_name else 'there'
                screening_summary = screening_result.get('summary', '')

                # Create filename with candidate name
                safe_name = "".join(c for c in candidate_name if c.isalnum() or c in (' ', '-', '_')).strip()
                safe_name = safe_name.replace(' ', '_') if safe_name else 'Unknown'
                final_upload_name = f"{safe_name}_Resume.pdf"

                # Upload resume to storage with candidate name
                resume_url = await upload_resume_to_storage(upload_bytes, final_upload_name, phone)

                # Update conversation state - mark resume received with context
                mark_resume_received(
                    phone,
                    applied_role=matched_job,
                    candidate_name=first_name,
                    screening_summary=screening_summary
                )

                # Save candidate with screening results
                await save_candidate(
                    user_id=phone,
                    username=phone,
                    full_name=name or f"WhatsApp User {phone}",
                    source="whatsapp",
                    screening_result=screening_result,
                    resume_url=resume_url,
                    conversation_history=get_conversation(phone)
                )

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
                await send_whatsapp_message(phone, response)

                # Update state to mark experience as asked
                update_conversation_state(phone, experience_discussed=True)
            else:
                await send_whatsapp_message(
                    phone,
                    "thanks for ur resume! had a bit of trouble reading it but our team will review it manually. anything else i can help u with?"
                )
                # Note: Don't create candidate without successful resume processing
        else:
            await send_whatsapp_message(
                phone,
                "had trouble downloading ur file. could u try sending it again?"
            )
    else:
        # Non-resume file - only respond if bot is active for this number
        if phone in bot_active_numbers:
            response = await get_ai_response(phone, f"[User sent a file: {file_name}]", candidate_name=name)
            await send_whatsapp_message(phone, response)


@app.post("/webhook")
async def webhook_handler(request: Request, background_tasks: BackgroundTasks):
    """Handle incoming Walichat webhooks."""
    try:
        data = await request.json()

        # Extract event type - Walichat uses format like "message:in:new"
        event_type = data.get("event", "")

        # Only process incoming messages (ignore outbound, status updates, etc.)
        if event_type != "message:in:new":
            return JSONResponse({"status": "ok"})

        # Get the message data - Walichat nests it under "data"
        message = data.get("data", {})
        if not message:
            return JSONResponse({"status": "ok"})

        # Extract phone number - prefer fromNumber (clean) or strip @c.us from 'from'
        phone = message.get("fromNumber") or message.get("from", "")
        phone = phone.replace("@c.us", "").replace("@s.whatsapp.net", "")
        # Ensure phone has + prefix for international format
        if phone and not phone.startswith("+"):
            phone = "+" + phone

        # Extract sender name from contact info
        contact = message.get("contact", {})
        name = (
            contact.get("name") or
            contact.get("shortName") or
            contact.get("pushName") or
            message.get("pushName") or
            ""
        )

        # Get message type and flow
        msg_type = message.get("type", "text")
        flow = message.get("flow", "inbound")

        # Only process inbound messages
        if flow != "inbound":
            return JSONResponse({"status": "ok"})

        if msg_type == "text":
            text = message.get("body", "")
            if text and phone:
                print(f"Message from {phone}: {text[:50]}...")
                background_tasks.add_task(process_text_message, phone, name, text, contact)

        elif msg_type == "document":
            # Document message - extract media info
            # Try multiple possible field locations for media data
            media = message.get("media", {})
            file_obj = message.get("file", {})
            document = message.get("document", {})

            # Try to get filename from various locations
            file_name = (
                media.get("filename") or media.get("name") or
                file_obj.get("filename") or file_obj.get("name") or
                document.get("filename") or document.get("name") or
                message.get("filename") or message.get("fileName") or
                "document.pdf"
            )

            # Try to get media URL from various locations
            media_url = (
                media.get("url") or media.get("link") or
                file_obj.get("url") or file_obj.get("link") or
                document.get("url") or document.get("link") or
                message.get("mediaUrl") or message.get("fileUrl") or
                message.get("url") or ""
            )

            # Try to get mime type
            mime_type = (
                media.get("mimetype") or media.get("mime_type") or
                file_obj.get("mimetype") or document.get("mimetype") or
                message.get("mimetype") or "application/pdf"
            )

            message_id = message.get("id", "")

            # Try to get file ID from various locations
            file_id = (
                media.get("id") or media.get("fileId") or
                file_obj.get("id") or file_obj.get("fileId") or
                document.get("id") or document.get("fileId") or
                message.get("fileId") or message.get("file_id") or
                message.get("mediaId") or message.get("media_id") or
                ""
            )

            if phone:
                print(f"Document from {phone}: {file_name}")
                background_tasks.add_task(
                    process_document_message, phone, name, file_name, media_url, mime_type, message_id, file_id, contact
                )

        return JSONResponse({"status": "ok"})

    except Exception as e:
        import traceback
        print(f"Webhook error: {e}")
        print(traceback.format_exc())
        return JSONResponse({"status": "error", "message": str(e)}, status_code=200)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "whatsapp-bot",
        "bot_enabled": BOT_ENABLED
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "WhatsApp Recruitment Bot",
        "status": "running",
        "webhook_url": "/webhook"
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
