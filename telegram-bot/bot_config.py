"""
Bot Configuration Settings
===========================
Centralized configuration for both Telegram and WhatsApp bots.
Modify these settings to customize bot behavior.
"""

from datetime import time
from zoneinfo import ZoneInfo
import os


# ============================================================================
# OPERATING HOURS CONFIGURATION
# ============================================================================

# Timezone for operating hours (Singapore time by default)
TIMEZONE = ZoneInfo("Asia/Singapore")

# Operating hours - bot will only respond within these hours
# Format: time(hour, minute) in 24-hour format
OPERATING_START = time(8, 30)   # 8:30 AM
OPERATING_END = time(22, 0)     # 10:00 PM (22:00)

# Set to True to disable operating hours restriction (bot responds 24/7)
DISABLE_TIME_RESTRICTION = False


# ============================================================================
# TELEGRAM BOT SETTINGS
# ============================================================================

# Quote/Reply Settings
# When True, the first response will quote/reply to the user's message
# When False, all responses are sent without quoting the original message
TELEGRAM_ENABLE_QUOTE_REPLY = True

# Message delays (in seconds)
# Set to 0 to disable typing delays
TELEGRAM_DELAY_MIN = 0.5
TELEGRAM_DELAY_MAX = 2.0


# ============================================================================
# WHATSAPP BOT SETTINGS
# ============================================================================

# Message delays (in seconds)
# Set to 0 to disable typing delays
WHATSAPP_DELAY_MIN = 0.5
WHATSAPP_DELAY_MAX = 2.0


# ============================================================================
# SPAM PROTECTION
# ============================================================================

# Rate limiting
RATE_LIMIT_MESSAGES = 10        # Max messages per time window
RATE_LIMIT_WINDOW = 60          # Time window in seconds (1 minute)

# Spam keywords to ignore (case-insensitive)
SPAM_KEYWORDS = [
    "crypto", "bitcoin", "ethereum", "investment opportunity",
    "make money fast", "work from home", "earn $", "earn usd",
    "click here", "free money", "lottery", "you have won",
    "nigerian prince", "wire transfer", "western union",
    "telegram premium", "free premium", "hack", "password"
]


# ============================================================================
# CONVERSATION SETTINGS
# ============================================================================

# Maximum number of messages to keep in conversation history
MAX_CONVERSATION_MESSAGES = 25

# Knowledgebase auto-refresh interval (in seconds)
KB_REFRESH_INTERVAL = 300  # 5 minutes


# ============================================================================
# ACCESS CONTROL
# ============================================================================

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


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def is_within_operating_hours() -> bool:
    """
    Check if current time is within operating hours.
    Returns True if bot should respond, False otherwise.
    """
    # If time restriction is disabled, always return True
    if DISABLE_TIME_RESTRICTION:
        return True

    from datetime import datetime
    now = datetime.now(TIMEZONE)
    current_time = now.time()
    return OPERATING_START <= current_time <= OPERATING_END


def print_config_summary():
    """Print a summary of current configuration (for debugging)."""
    print("\n" + "="*60)
    print("BOT CONFIGURATION SUMMARY")
    print("="*60)
    print(f"Timezone: {TIMEZONE}")
    print(f"Operating Hours: {OPERATING_START.strftime('%H:%M')} - {OPERATING_END.strftime('%H:%M')}")
    print(f"Time Restriction Disabled: {DISABLE_TIME_RESTRICTION}")
    print(f"Telegram Quote Reply: {TELEGRAM_ENABLE_QUOTE_REPLY}")
    print(f"Rate Limit: {RATE_LIMIT_MESSAGES} messages per {RATE_LIMIT_WINDOW}s")
    print(f"Max Conversation Messages: {MAX_CONVERSATION_MESSAGES}")
    print(f"Knowledgebase Refresh: every {KB_REFRESH_INTERVAL}s")
    print(f"Whitelist Mode: {is_whitelist_mode()}")
    print("="*60 + "\n")


# ============================================================================
# USAGE EXAMPLES
# ============================================================================
"""
Example 1: Change operating hours to 9 AM - 6 PM
    OPERATING_START = time(9, 0)
    OPERATING_END = time(18, 0)

Example 2: Enable 24/7 operation
    DISABLE_TIME_RESTRICTION = True

Example 3: Disable quote reply in Telegram
    TELEGRAM_ENABLE_QUOTE_REPLY = False

Example 4: Disable typing delays
    TELEGRAM_DELAY_MIN = 0
    TELEGRAM_DELAY_MAX = 0
"""
