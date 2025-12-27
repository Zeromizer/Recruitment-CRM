"""
WhatsApp Bot using Walichat API
Handles incoming messages via webhooks and sends responses via Walichat REST API.
"""
import os
import sys
import asyncio
import httpx
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

# Add parent directory to path for shared imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from shared.ai_screening import get_ai_response, screen_resume, init_anthropic, get_conversation
from shared.database import save_candidate, upload_resume_to_storage, init_supabase
from shared.resume_parser import extract_text_from_pdf
from shared.google_sheets import init_google_sheets
from shared.spam_protection import is_rate_limited, contains_spam, is_user_allowed

# Walichat API configuration
WALICHAT_API_BASE = "https://api.wali.chat/v1"
WALICHAT_API_TOKEN = os.environ.get('WALICHAT_API_TOKEN')
WALICHAT_DEVICE_ID = os.environ.get('WALICHAT_DEVICE_ID')

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


async def send_whatsapp_message(phone: str, message: str) -> bool:
    """Send a WhatsApp message via Walichat API."""
    try:
        payload = {
            "phone": phone,
            "message": message,
        }

        # Add device ID if configured
        if WALICHAT_DEVICE_ID:
            payload["device"] = WALICHAT_DEVICE_ID

        response = await http_client.post("/messages", json=payload)

        if response.status_code == 200 or response.status_code == 201:
            print(f"Message sent to {phone}")
            return True
        else:
            print(f"Failed to send message: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"Error sending WhatsApp message: {e}")
        return False


async def download_media(media_url: str) -> bytes:
    """Download media file from Walichat."""
    try:
        response = await http_client.get(media_url)
        if response.status_code == 200:
            return response.content
        else:
            print(f"Failed to download media: {response.status_code}")
            return None
    except Exception as e:
        print(f"Error downloading media: {e}")
        return None


async def process_text_message(phone: str, name: str, text: str):
    """Process a text message from WhatsApp."""
    print(f"Message from {name} ({phone}): {text}")

    # Check spam protection
    allowed, reason = is_user_allowed(phone)
    if not allowed:
        print(f"Blocked user {phone}: {reason}")
        return

    if is_rate_limited(phone):
        print(f"Rate limited user {phone}")
        await send_whatsapp_message(phone, "You're sending messages too quickly. Please wait a moment.")
        return

    if contains_spam(text):
        print(f"Spam detected from {phone}: {text[:50]}...")
        return

    # Get AI response
    response = await get_ai_response(phone, text)
    await send_whatsapp_message(phone, response)

    # Save candidate
    await save_candidate(
        user_id=phone,
        username=phone,
        full_name=name or f"WhatsApp User {phone}",
        source="whatsapp",
        conversation_history=get_conversation(phone)
    )


async def process_document_message(phone: str, name: str, file_name: str, media_url: str, mime_type: str):
    """Process a document message (resume) from WhatsApp."""
    print(f"Document from {name} ({phone}): {file_name} ({mime_type})")

    # Check spam protection
    allowed, reason = is_user_allowed(phone)
    if not allowed:
        print(f"Blocked user {phone}: {reason}")
        return

    # Check if it's a resume
    is_resume = (
        mime_type == "application/pdf" or
        file_name.lower().endswith('.pdf') or
        mime_type in ["application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"] or
        file_name.lower().endswith(('.doc', '.docx'))
    )

    if is_resume:
        await send_whatsapp_message(phone, "Thank you for your resume! I'm processing it now...")

        # Download the file
        file_bytes = await download_media(media_url)

        if file_bytes:
            # Extract text from PDF
            if mime_type == "application/pdf" or file_name.lower().endswith('.pdf'):
                resume_text = extract_text_from_pdf(file_bytes)
            else:
                resume_text = f"[Document received: {file_name}]"

            if resume_text and len(resume_text) > 100:
                print(f"Extracted {len(resume_text)} characters from resume")

                # Upload resume to storage
                resume_url = await upload_resume_to_storage(file_bytes, file_name, phone)

                # Screen the resume
                screening_result = await screen_resume(resume_text)
                print(f"Screening result: {screening_result.get('recommendation', 'Unknown')}")

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

                # Generate response
                matched_job = screening_result.get('job_matched', 'our open positions')
                candidate_name = screening_result.get('candidate_name', name or 'candidate')

                response = f"""Thank you for submitting your resume, {candidate_name}!

I've reviewed your application and found you could be a great fit for *{matched_job}*.

Our recruitment team will review your profile and get back to you soon. In the meantime, is there anything specific about the role you'd like to know?"""

                await send_whatsapp_message(phone, response)
            else:
                print("Could not extract sufficient text from resume")
                await send_whatsapp_message(
                    phone,
                    "Thank you for your resume! I received the file but had trouble reading its contents. "
                    "Our team will review it manually. Is there anything else I can help you with?"
                )
                await save_candidate(
                    user_id=phone,
                    username=phone,
                    full_name=name or f"WhatsApp User {phone}",
                    source="whatsapp"
                )
        else:
            print("Failed to download file")
            await send_whatsapp_message(
                phone,
                "I had trouble downloading your file. Could you please try sending it again?"
            )
    else:
        # Non-resume file
        response = await get_ai_response(phone, f"[User sent a file: {file_name}]")
        await send_whatsapp_message(phone, response)
        await save_candidate(
            user_id=phone,
            username=phone,
            full_name=name or f"WhatsApp User {phone}",
            source="whatsapp"
        )


@app.post("/webhook")
async def webhook_handler(request: Request, background_tasks: BackgroundTasks):
    """Handle incoming Walichat webhooks."""
    try:
        data = await request.json()
        print(f"Webhook received: {data}")

        # Extract event type - Walichat uses format like "message:in:new"
        event_type = data.get("event", "")

        # Only process incoming messages (ignore outbound, status updates, etc.)
        if event_type != "message:in:new":
            print(f"Ignoring event type: {event_type}")
            return JSONResponse({"status": "ok"})

        # Get the message data - Walichat nests it under "data"
        message = data.get("data", {})

        if not message:
            print("No message data found")
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
            print(f"Ignoring outbound message")
            return JSONResponse({"status": "ok"})

        print(f"Processing message - Phone: {phone}, Name: {name}, Type: {msg_type}")

        if msg_type == "text":
            # Text message - content is in "body"
            text = message.get("body", "")
            if text and phone:
                print(f"Text message from {phone}: {text}")
                background_tasks.add_task(process_text_message, phone, name, text)

        elif msg_type == "document":
            # Document message
            media = message.get("media", {})
            file_name = media.get("filename", "document.pdf")
            media_url = media.get("url") or media.get("link", "")
            mime_type = media.get("mimetype", "application/pdf")

            if phone:
                print(f"Document from {phone}: {file_name}")
                background_tasks.add_task(
                    process_document_message, phone, name, file_name, media_url, mime_type
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
    return {"status": "healthy", "service": "whatsapp-bot"}


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
