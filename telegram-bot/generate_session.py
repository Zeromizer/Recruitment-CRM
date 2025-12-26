"""
Run this script LOCALLY to generate a Telegram session string.
You will need to enter your phone number and the verification code sent to you.

Usage:
    python generate_session.py

After running, copy the session string and add it to Railway as:
    TELEGRAM_SESSION_STRING=<your_session_string>
"""
import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession

API_ID = input("Enter your TELEGRAM_API_ID: ")
API_HASH = input("Enter your TELEGRAM_API_HASH: ")
PHONE = input("Enter your phone number (with country code, e.g., +1234567890): ")


async def main():
    client = TelegramClient(StringSession(), int(API_ID), API_HASH)
    await client.start(phone=PHONE)
    session_string = client.session.save()
    print("\n" + "=" * 60)
    print("SUCCESS! Here is your session string:")
    print("=" * 60)
    print(session_string)
    print("=" * 60)
    print("\nAdd this to Railway as environment variable:")
    print("TELEGRAM_SESSION_STRING=<paste the string above>")
    print("\nKEEP THIS SECRET! Anyone with this string can access your account.")
    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
