import os
import sys
import json
import asyncio
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from anthropic import Anthropic
from supabase import create_client, Client

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

# Global clients - initialized in main()
client = None
anthropic_client = None
supabase_client = None


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
    add_message(user_id, "user", message)
    try:
        response = anthropic_client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=get_conversation(user_id)
        )
        ai_message = response.content[0].text
        add_message(user_id, "assistant", ai_message)
        return ai_message
    except Exception as e:
        print(f"Error getting AI response: {e}")
        return "I apologize, but I'm having trouble processing your message. Please try again."


async def save_candidate(user_id: int, username: str, full_name: str):
    try:
        conv_history = get_conversation(user_id)
        data = {
            "full_name": full_name or f"Telegram User {user_id}",
            "telegram_user_id": user_id,
            "telegram_username": username,
            "source": "telegram",
            "status": "new",
            "conversation_history": json.dumps(conv_history)
        }
        existing = supabase_client.table("candidates").select("id").eq("telegram_user_id", user_id).execute()
        if existing.data:
            supabase_client.table("candidates").update(data).eq("telegram_user_id", user_id).execute()
            print(f"Updated candidate: {full_name}")
        else:
            supabase_client.table("candidates").insert(data).execute()
            print(f"Created new candidate: {full_name}")
    except Exception as e:
        print(f"Error saving candidate: {e}")


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

    return True


def setup_handlers(telegram_client):
    """Setup message handlers for the Telegram client."""

    @telegram_client.on(events.NewMessage(incoming=True))
    async def handle_message(event):
        if event.is_private:
            sender = await event.get_sender()
            user_id = sender.id
            username = sender.username or ""
            full_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip()
            print(f"Message from {full_name} (@{username}): {event.text}")
            async with telegram_client.action(event.chat_id, 'typing'):
                response = await get_ai_response(user_id, event.text)
            await event.respond(response)
            await save_candidate(user_id, username, full_name)

    @telegram_client.on(events.NewMessage(incoming=True, func=lambda e: e.file))
    async def handle_file(event):
        if event.is_private:
            sender = await event.get_sender()
            user_id = sender.id
            username = sender.username or ""
            full_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip()
            print(f"File received from {full_name} (@{username})")
            async with telegram_client.action(event.chat_id, 'typing'):
                response = await get_ai_response(user_id, "[User sent a file/resume]")
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
