# Bot Configuration Guide

## Overview

The bot configuration is centralized in `bot_config.py`. This file controls key behaviors for both Telegram and WhatsApp bots, including:

- Operating hours restrictions
- Quote/reply behavior for Telegram
- Message typing delays
- Spam protection settings
- Conversation memory limits

## Quick Start

### Viewing Current Configuration

When you start either bot, you'll see a configuration summary:

```
============================================================
BOT CONFIGURATION SUMMARY
============================================================
Timezone: Asia/Singapore
Operating Hours: 08:30 - 22:00
Time Restriction Disabled: False
Telegram Quote Reply: True
Rate Limit: 10 messages per 60s
Max Conversation Messages: 25
Knowledgebase Refresh: every 300s
Whitelist Mode: False
============================================================
```

## Common Configuration Changes

### 1. Change Operating Hours

Edit `bot_config.py`:

```python
OPERATING_START = time(9, 0)    # 9:00 AM
OPERATING_END = time(18, 0)     # 6:00 PM
```

### 2. Enable 24/7 Operation (No Time Restrictions)

Edit `bot_config.py`:

```python
DISABLE_TIME_RESTRICTION = True
```

### 3. Disable Quote Reply in Telegram

By default, the Telegram bot "quotes" (replies to) the user's message when sending the first response. To disable this:

Edit `bot_config.py`:

```python
TELEGRAM_ENABLE_QUOTE_REPLY = False
```

**What this does:**
- `True`: First message quotes the user's message (shows as a reply)
- `False`: All messages are sent normally without quoting

### 4. Adjust Message Delays

For Telegram:
```python
TELEGRAM_DELAY_MIN = 1.0   # Minimum delay in seconds
TELEGRAM_DELAY_MAX = 3.0   # Maximum delay in seconds
```

For WhatsApp:
```python
WHATSAPP_DELAY_MIN = 1.0
WHATSAPP_DELAY_MAX = 3.0
```

To disable delays entirely:
```python
TELEGRAM_DELAY_MIN = 0
TELEGRAM_DELAY_MAX = 0
```

### 5. Change Timezone

```python
TIMEZONE = ZoneInfo("America/New_York")  # Eastern Time
# or
TIMEZONE = ZoneInfo("Europe/London")     # GMT/BST
# or
TIMEZONE = ZoneInfo("Asia/Tokyo")        # Japan
```

## All Configuration Options

### Operating Hours
| Setting | Default | Description |
|---------|---------|-------------|
| `TIMEZONE` | `Asia/Singapore` | Timezone for operating hours |
| `OPERATING_START` | `time(8, 30)` | Start time (8:30 AM) |
| `OPERATING_END` | `time(22, 0)` | End time (10:00 PM) |
| `DISABLE_TIME_RESTRICTION` | `False` | Set to `True` for 24/7 operation |

### Telegram Settings
| Setting | Default | Description |
|---------|---------|-------------|
| `TELEGRAM_ENABLE_QUOTE_REPLY` | `True` | Quote user's message in first response |
| `TELEGRAM_DELAY_MIN` | `0.5` | Minimum typing delay (seconds) |
| `TELEGRAM_DELAY_MAX` | `2.0` | Maximum typing delay (seconds) |

### WhatsApp Settings
| Setting | Default | Description |
|---------|---------|-------------|
| `WHATSAPP_DELAY_MIN` | `0.5` | Minimum typing delay (seconds) |
| `WHATSAPP_DELAY_MAX` | `2.0` | Maximum typing delay (seconds) |

### Spam Protection
| Setting | Default | Description |
|---------|---------|-------------|
| `RATE_LIMIT_MESSAGES` | `10` | Max messages per time window |
| `RATE_LIMIT_WINDOW` | `60` | Time window in seconds |
| `SPAM_KEYWORDS` | (list) | Keywords to ignore (case-insensitive) |

### Conversation Settings
| Setting | Default | Description |
|---------|---------|-------------|
| `MAX_CONVERSATION_MESSAGES` | `25` | Max messages kept in memory |
| `KB_REFRESH_INTERVAL` | `300` | Knowledgebase refresh interval (seconds) |

## Testing Your Configuration

After making changes to `bot_config.py`, test the configuration:

```bash
cd telegram-bot
python3 -c "from bot_config import *; print_config_summary()"
```

You should see the updated configuration displayed.

## Applying Changes

**No restart needed for most settings!** The bots read from `bot_config.py` on import.

1. Edit `bot_config.py` with your desired settings
2. Restart the bot (the configuration is loaded at startup)
3. Check the configuration summary when the bot starts

## Environment Variables (Advanced)

Some settings can be controlled via environment variables:

### Access Control
- `BLOCKED_TELEGRAM_USERS`: Comma-separated user IDs to block
  ```bash
  export BLOCKED_TELEGRAM_USERS="123456,789012"
  ```

- `WHITELIST_TELEGRAM_USERS`: Allowed user IDs (if whitelist mode enabled)
  ```bash
  export WHITELIST_TELEGRAM_USERS="123456,789012"
  ```

- `TELEGRAM_WHITELIST_MODE`: Enable whitelist mode (`true`, `1`, or `yes`)
  ```bash
  export TELEGRAM_WHITELIST_MODE=true
  ```

## Troubleshooting

### Bot not responding outside business hours

Check these settings:
1. `OPERATING_START` and `OPERATING_END` match your desired hours
2. `TIMEZONE` is correct for your location
3. `DISABLE_TIME_RESTRICTION` is `False` (unless you want 24/7)

### Quote reply still showing in Telegram

Make sure:
1. `TELEGRAM_ENABLE_QUOTE_REPLY = False` in `bot_config.py`
2. Bot was restarted after the change
3. Configuration summary shows "Telegram Quote Reply: False"

### Messages sending too fast/slow

Adjust the delay settings:
- For faster responses: Lower `DELAY_MIN` and `DELAY_MAX`
- For more realistic typing: Increase `DELAY_MIN` and `DELAY_MAX`
- To disable delays entirely: Set both to `0`

## Examples

### Example 1: Business Hours Setup (9 AM - 5 PM)

```python
OPERATING_START = time(9, 0)
OPERATING_END = time(17, 0)
DISABLE_TIME_RESTRICTION = False
```

### Example 2: 24/7 Operation with No Quote Reply

```python
DISABLE_TIME_RESTRICTION = True
TELEGRAM_ENABLE_QUOTE_REPLY = False
```

### Example 3: Fast Response Bot (No Delays)

```python
TELEGRAM_DELAY_MIN = 0
TELEGRAM_DELAY_MAX = 0
WHATSAPP_DELAY_MIN = 0
WHATSAPP_DELAY_MAX = 0
```

### Example 4: Different Timezone (New York)

```python
from zoneinfo import ZoneInfo
TIMEZONE = ZoneInfo("America/New_York")
OPERATING_START = time(9, 0)   # 9 AM EST/EDT
OPERATING_END = time(17, 0)    # 5 PM EST/EDT
```

## Support

For issues or questions about bot configuration, check:
1. Configuration summary when bot starts
2. This README for examples
3. Comments in `bot_config.py` for detailed explanations
