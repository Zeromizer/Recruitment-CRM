import os
import json
import asyncio
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from anthropic import Anthropic
from supabase import create_client, Client

# Environment variables
API_ID = int(os.environ.get('TELEGRAM_API_ID', '0'))
API_HASH = os.environ.get('TELEGRAM_API_HASH', '')
SESSION_STRING = os.environ.get('TELEGRAM_SESSION_STRING', '')
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_ANON_KEY', '')

# Initialize clients - use StringSession for pre-authenticated session
client = TelegramClient(StringSession(SESSION_STRING), API_ID, API_HASH)
anthropic = Anthropic(api_key=CLAUDE_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
        response = anthropic.messages.create(
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
        existing = supabase.table("candidates").select("id").eq("telegram_user_id", user_id).execute()
        if existing.data:
            supabase.table("candidates").update(data).eq("telegram_user_id", user_id).execute()
            print(f"Updated candidate: {full_name}")
        else:
            supabase.table("candidates").insert(data).execute()
            print(f"Created new candidate: {full_name}")
    except Exception as e:
        print(f"Error saving candidate: {e}")


@client.on(events.NewMessage(incoming=True))
async def handle_message(event):
    if event.is_private:
        sender = await event.get_sender()
        user_id = sender.id
        username = sender.username or ""
        full_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip()
        print(f"Message from {full_name} (@{username}): {event.text}")
        async with client.action(event.chat_id, 'typing'):
            response = await get_ai_response(user_id, event.text)
        await event.respond(response)
        await save_candidate(user_id, username, full_name)


@client.on(events.NewMessage(incoming=True, func=lambda e: e.file))
async def handle_file(event):
    if event.is_private:
        sender = await event.get_sender()
        user_id = sender.id
        username = sender.username or ""
        full_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip()
        print(f"File received from {full_name} (@{username})")
        async with client.action(event.chat_id, 'typing'):
            response = await get_ai_response(user_id, "[User sent a file/resume]")
        await event.respond(response)
        await save_candidate(user_id, username, full_name)


async def main():
    print("Starting Telegram bot...")
    await client.start()
    print("Bot is running!")
    await client.run_until_disconnected()


if __name__ == "__main__":
    asyncio.run(main())
