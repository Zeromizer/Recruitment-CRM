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
        # Clean phone number - remove any non-numeric chars except +
        clean_phone = phone.strip()

        payload = {
            "phone": clean_phone,
            "message": message,
            "device": WALICHAT_DEVICE_ID,  # Always include device ID
        }

        print(f"Sending message to {clean_phone} via device {WALICHAT_DEVICE_ID}")
        print(f"Payload: {payload}")

        response = await http_client.post("/messages", json=payload)

        if response.status_code == 200 or response.status_code == 201:
            print(f"Message sent to {clean_phone}")
            return True
        else:
            print(f"Failed to send message: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"Error sending WhatsApp message: {e}")
        import traceback
        print(traceback.format_exc())
        return False


async def download_media(media_url: str, file_id: str = None, message_id: str = None) -> bytes:
    """Download media file from Walichat."""
    print(f"Attempting to download media")
    print(f"Media URL: {media_url}")
    print(f"File ID: {file_id}")
    print(f"Message ID: {message_id}")

    # Primary method: Use file ID with /files/{id}/download endpoint
    if file_id:
        try:
            api_url = f"/files/{file_id}/download"
            print(f"Trying Walichat files API: {api_url}")
            response = await http_client.get(api_url)
            if response.status_code == 200:
                print(f"Successfully downloaded via files API ({len(response.content)} bytes)")
                return response.content
            else:
                print(f"Files API failed: {response.status_code} - {response.text[:200]}")
        except Exception as e:
            print(f"Files API error: {e}")

    # Fallback: Try with message ID
    if message_id:
        try:
            api_url = f"/files/{message_id}/download"
            print(f"Trying with message ID as file ID: {api_url}")
            response = await http_client.get(api_url)
            if response.status_code == 200:
                print(f"Successfully downloaded ({len(response.content)} bytes)")
                return response.content
            else:
                print(f"Download failed: {response.status_code}")
        except Exception as e:
            print(f"Download error: {e}")

    # Try direct URL download (for external URLs like WhatsApp servers)
    if media_url:
        try:
            async with httpx.AsyncClient(timeout=60.0) as external_client:
                print(f"Trying direct URL download: {media_url}")
                response = await external_client.get(media_url)
                if response.status_code == 200:
                    print(f"Successfully downloaded directly ({len(response.content)} bytes)")
                    return response.content
                else:
                    print(f"Direct download failed: {response.status_code}")
        except Exception as e:
            print(f"Direct download error: {e}")

    print("All download methods failed")
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

    # Note: Only create candidate record when resume is received (not on text messages)


async def process_document_message(phone: str, name: str, file_name: str, media_url: str, mime_type: str, message_id: str = "", file_id: str = ""):
    """Process a document message (resume) from WhatsApp."""
    print(f"Document from {name} ({phone}): {file_name} ({mime_type})")
    print(f"Media URL: {media_url}, Message ID: {message_id}, File ID: {file_id}")

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

        # Download the file - try with file ID first, then message ID, then direct URL
        file_bytes = await download_media(media_url, file_id, message_id)

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
                # Note: Don't create candidate without successful resume processing
        else:
            print("Failed to download file")
            await send_whatsapp_message(
                phone,
                "I had trouble downloading your file. Could you please try sending it again?"
            )
    else:
        # Non-resume file - just respond, don't create candidate
        response = await get_ai_response(phone, f"[User sent a file: {file_name}]")
        await send_whatsapp_message(phone, response)


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

            # Log ALL fields to debug
            print(f"=== DOCUMENT MESSAGE DEBUG ===")
            print(f"Message ID: {message_id}")
            print(f"File ID: {file_id}")
            print(f"File name: {file_name}")
            print(f"Media URL: {media_url}")
            print(f"Mime type: {mime_type}")
            print(f"Media object: {media}")
            print(f"File object: {file_obj}")
            print(f"Document object: {document}")
            print(f"Full message keys: {list(message.keys())}")
            print(f"=== END DEBUG ===")

            if phone:
                print(f"Document from {phone}: {file_name}")
                background_tasks.add_task(
                    process_document_message, phone, name, file_name, media_url, mime_type, message_id, file_id
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
