"""Spam protection utilities."""
import os
import time

# Rate limiting
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


def get_blocked_users(env_var: str = 'BLOCKED_USERS') -> set:
    """Get set of blocked user IDs from environment variable."""
    blocked = os.environ.get(env_var, '')
    if not blocked:
        # Also check platform-specific var
        blocked = os.environ.get('BLOCKED_TELEGRAM_USERS', '') or os.environ.get('BLOCKED_WHATSAPP_USERS', '')
    if not blocked:
        return set()
    try:
        return set(uid.strip() for uid in blocked.split(',') if uid.strip())
    except ValueError:
        return set()


def get_whitelist_users(env_var: str = 'WHITELIST_USERS') -> set:
    """Get set of whitelisted user IDs (if whitelist mode is enabled)."""
    whitelist = os.environ.get(env_var, '')
    if not whitelist:
        # Also check platform-specific var
        whitelist = os.environ.get('WHITELIST_TELEGRAM_USERS', '') or os.environ.get('WHITELIST_WHATSAPP_USERS', '')
    if not whitelist:
        return set()
    try:
        return set(uid.strip() for uid in whitelist.split(',') if uid.strip())
    except ValueError:
        return set()


def is_whitelist_mode(env_var: str = 'WHITELIST_MODE') -> bool:
    """Check if whitelist mode is enabled."""
    mode = os.environ.get(env_var, '')
    if not mode:
        # Also check platform-specific var
        mode = os.environ.get('TELEGRAM_WHITELIST_MODE', '') or os.environ.get('WHATSAPP_WHITELIST_MODE', '')
    return mode.lower() in ('true', '1', 'yes')


def is_user_allowed(user_id: str) -> tuple:
    """Check if a user is allowed to interact with the bot.
    Returns (allowed, reason) tuple.
    """
    user_key = str(user_id)

    # Check blocked list
    if user_key in get_blocked_users():
        return False, "blocked"

    # Check whitelist mode
    if is_whitelist_mode():
        whitelist = get_whitelist_users()
        if whitelist and user_key not in whitelist:
            return False, "not_whitelisted"

    return True, "allowed"


def is_rate_limited(user_id: str) -> bool:
    """Check if user has exceeded rate limit."""
    user_key = str(user_id)
    current_time = time.time()

    if user_key not in rate_limit_tracker:
        rate_limit_tracker[user_key] = []

    # Remove old timestamps outside the window
    rate_limit_tracker[user_key] = [
        ts for ts in rate_limit_tracker[user_key]
        if current_time - ts < RATE_LIMIT_WINDOW
    ]

    # Check if over limit
    if len(rate_limit_tracker[user_key]) >= RATE_LIMIT_MESSAGES:
        return True

    # Add current timestamp
    rate_limit_tracker[user_key].append(current_time)
    return False


def contains_spam(text: str) -> bool:
    """Check if message contains spam keywords."""
    if not text:
        return False
    text_lower = text.lower()
    return any(keyword in text_lower for keyword in SPAM_KEYWORDS)
