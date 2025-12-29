"""
Training Handlers for Telegram Bot

This module provides command handlers for training the knowledgebase
through Telegram chat. Admin users can add, update, and manage
knowledge entries by chatting with the bot.

Commands:
    /train          - Enter training mode / show training menu
    /add_role       - Add a new job role
    /add_faq        - Add a new FAQ
    /update_style   - Update communication style
    /list_roles     - List all job roles
    /list_faqs      - List all FAQs
    /delete         - Delete a knowledge entry
    /export_kb      - Export knowledgebase to JSON
    /seed_kb        - Seed default knowledgebase
    /refresh_kb     - Refresh knowledgebase from database
    /train_exit     - Exit training mode
"""

import os
import json
from typing import Optional, Dict, List, Set
from dataclasses import dataclass, field

# Admin user IDs who can train the bot (comma-separated in env)
ADMIN_USER_IDS: Set[int] = set()

# Training session state
@dataclass
class TrainingSession:
    """Tracks active training session for a user."""
    user_id: int
    mode: str = None  # 'add_role', 'add_faq', etc.
    step: int = 0
    data: Dict = field(default_factory=dict)


# Active training sessions
training_sessions: Dict[int, TrainingSession] = {}


def init_admin_users():
    """Initialize admin user IDs from environment variable."""
    global ADMIN_USER_IDS
    admin_ids = os.environ.get('TELEGRAM_ADMIN_USERS', '')
    if admin_ids:
        try:
            ADMIN_USER_IDS = set(int(uid.strip()) for uid in admin_ids.split(',') if uid.strip())
            print(f"Loaded {len(ADMIN_USER_IDS)} admin users for training")
        except ValueError:
            print("Warning: Invalid TELEGRAM_ADMIN_USERS format")


def is_admin(user_id: int) -> bool:
    """Check if user is an admin who can train the bot."""
    return user_id in ADMIN_USER_IDS


def get_training_session(user_id: int) -> Optional[TrainingSession]:
    """Get active training session for user."""
    return training_sessions.get(user_id)


def start_training_session(user_id: int, mode: str) -> TrainingSession:
    """Start a new training session."""
    session = TrainingSession(user_id=user_id, mode=mode)
    training_sessions[user_id] = session
    return session


def end_training_session(user_id: int):
    """End a training session."""
    if user_id in training_sessions:
        del training_sessions[user_id]


def is_in_training_mode(user_id: int) -> bool:
    """Check if user is in training mode."""
    return user_id in training_sessions


# =============================================================================
# COMMAND HANDLERS
# =============================================================================

async def handle_train_command(user_id: int, username: str) -> str:
    """Handle /train command - show training menu."""
    if not is_admin(user_id):
        return "Sorry, only admins can train the bot. Contact the bot owner to get access."

    menu = """
**Training Mode**

Available commands:

**Add Knowledge**
/add_role - Add a new job role
/add_faq - Add a new FAQ entry
/update_style - Update communication style

**View Knowledge**
/list_roles - List all job roles
/list_faqs - List all FAQs
/list_all - List all knowledge entries

**Manage**
/delete <category> <key> - Delete an entry
/refresh_kb - Reload from database
/seed_kb - Seed default entries
/export_kb - Export to JSON

/train_exit - Exit training mode

Just type a command to get started!
"""
    return menu


async def handle_add_role_command(user_id: int) -> str:
    """Start adding a new role."""
    if not is_admin(user_id):
        return "Only admins can add roles."

    session = start_training_session(user_id, "add_role")
    session.step = 1

    return """
**Adding New Job Role**

Step 1/5: What's the key/ID for this role?
(e.g., "waiter", "cashier", "driver")

Just type the key:
"""


async def handle_add_faq_command(user_id: int) -> str:
    """Start adding a new FAQ."""
    if not is_admin(user_id):
        return "Only admins can add FAQs."

    session = start_training_session(user_id, "add_faq")
    session.step = 1

    return """
**Adding New FAQ**

Step 1/3: What's the key/ID for this FAQ?
(e.g., "pay_rate", "work_hours", "dress_code")

Just type the key:
"""


async def handle_list_roles_command() -> str:
    """List all job roles."""
    try:
        from .knowledgebase_db import list_knowledge, CATEGORY_ROLE

        entries = await list_knowledge(CATEGORY_ROLE)

        if not entries:
            return "No roles in database. Use /seed_kb to add defaults or /add_role to add manually."

        lines = ["**Job Roles in Database:**\n"]
        for entry in entries:
            value = entry.get("value", {})
            title = value.get("title", entry["key"])
            keywords = ", ".join(value.get("keywords", [])[:3])
            lines.append(f"- **{entry['key']}**: {title}")
            if keywords:
                lines.append(f"  Keywords: {keywords}")

        return "\n".join(lines)

    except Exception as e:
        return f"Error listing roles: {e}"


async def handle_list_faqs_command() -> str:
    """List all FAQs."""
    try:
        from .knowledgebase_db import list_knowledge, CATEGORY_FAQ

        entries = await list_knowledge(CATEGORY_FAQ)

        if not entries:
            return "No FAQs in database. Use /seed_kb to add defaults or /add_faq to add manually."

        lines = ["**FAQs in Database:**\n"]
        for entry in entries:
            value = entry.get("value", {})
            question = value.get("question", entry["key"])
            lines.append(f"- **{entry['key']}**: {question}")

        return "\n".join(lines)

    except Exception as e:
        return f"Error listing FAQs: {e}"


async def handle_list_all_command() -> str:
    """List all knowledge entries."""
    try:
        from .knowledgebase_db import list_knowledge

        entries = await list_knowledge()

        if not entries:
            return "No entries in database. Use /seed_kb to populate with defaults."

        # Group by category
        by_category = {}
        for entry in entries:
            cat = entry["category"]
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(entry["key"])

        lines = ["**All Knowledge Entries:**\n"]
        for cat, keys in sorted(by_category.items()):
            lines.append(f"**{cat}** ({len(keys)} entries):")
            lines.append("  " + ", ".join(keys[:10]))
            if len(keys) > 10:
                lines.append(f"  ... and {len(keys) - 10} more")
            lines.append("")

        return "\n".join(lines)

    except Exception as e:
        return f"Error listing entries: {e}"


async def handle_delete_command(user_id: int, args: str) -> str:
    """Handle /delete category key command."""
    if not is_admin(user_id):
        return "Only admins can delete entries."

    parts = args.strip().split(maxsplit=1)
    if len(parts) < 2:
        return "Usage: /delete <category> <key>\nExample: /delete role waiter"

    category, key = parts

    try:
        from .knowledgebase_db import delete_knowledge

        success = await delete_knowledge(category, key)
        if success:
            return f"Deleted {category}/{key} successfully."
        else:
            return f"Failed to delete {category}/{key}. It may not exist."

    except Exception as e:
        return f"Error deleting: {e}"


async def handle_refresh_command(user_id: int) -> str:
    """Refresh knowledgebase from database."""
    if not is_admin(user_id):
        return "Only admins can refresh the knowledgebase."

    try:
        from .knowledgebase import reload_from_database

        success = await reload_from_database()
        if success:
            return "Knowledgebase refreshed from database!"
        else:
            return "No entries in database to load. Using static defaults."

    except Exception as e:
        return f"Error refreshing: {e}"


async def handle_seed_command(user_id: int) -> str:
    """Seed default knowledgebase entries."""
    if not is_admin(user_id):
        return "Only admins can seed the knowledgebase."

    try:
        from .knowledgebase_db import seed_default_knowledgebase
        from .knowledgebase import RECRUITER_NAME

        await seed_default_knowledgebase(RECRUITER_NAME)
        return "Default knowledgebase entries seeded! Use /refresh_kb to load them."

    except Exception as e:
        return f"Error seeding: {e}"


async def handle_export_command(user_id: int) -> str:
    """Export knowledgebase to JSON."""
    if not is_admin(user_id):
        return "Only admins can export the knowledgebase."

    try:
        from .knowledgebase_db import load_full_knowledgebase

        kb = await load_full_knowledgebase()
        export = json.dumps(kb, indent=2, ensure_ascii=False)

        # Truncate if too long for Telegram
        if len(export) > 4000:
            export = export[:4000] + "\n... (truncated)"

        return f"```json\n{export}\n```"

    except Exception as e:
        return f"Error exporting: {e}"


async def handle_train_exit(user_id: int) -> str:
    """Exit training mode."""
    end_training_session(user_id)
    return "Exited training mode. Back to normal conversation mode."


# =============================================================================
# TRAINING FLOW HANDLERS
# =============================================================================

async def process_training_input(user_id: int, text: str) -> Optional[str]:
    """
    Process input during active training session.

    Returns response string if in training mode, None otherwise.
    """
    session = get_training_session(user_id)
    if not session:
        return None

    if session.mode == "add_role":
        return await process_add_role_step(session, text)
    elif session.mode == "add_faq":
        return await process_add_faq_step(session, text)

    return None


async def process_add_role_step(session: TrainingSession, text: str) -> str:
    """Process steps for adding a new role."""
    text = text.strip()

    if session.step == 1:
        # Get role key
        session.data["key"] = text.lower().replace(" ", "_")
        session.step = 2
        return f"""
Got it! Role key: **{session.data['key']}**

Step 2/5: What's the display title for this role?
(e.g., "Restaurant Waiter", "Retail Cashier")
"""

    elif session.step == 2:
        # Get title
        session.data["title"] = text
        session.step = 3
        return f"""
Title: **{session.data['title']}**

Step 3/5: What keywords should trigger this role?
(comma-separated, e.g., "waiter, waitress, restaurant, f&b, server")
"""

    elif session.step == 3:
        # Get keywords
        keywords = [k.strip().lower() for k in text.split(",")]
        session.data["keywords"] = keywords
        session.step = 4
        return f"""
Keywords: {', '.join(keywords)}

Step 4/5: What experience question should we ask?
(e.g., "do u have experience in f&b or customer service?")
"""

    elif session.step == 4:
        # Get experience question
        session.data["question"] = text
        session.step = 5
        return f"""
Question: "{session.data['question']}"

Step 5/5: Any notes about this role? (or type "skip" to skip)
"""

    elif session.step == 5:
        # Get notes and save
        notes = "" if text.lower() == "skip" else text
        session.data["notes"] = notes

        try:
            from .knowledgebase_db import add_role

            success = await add_role(
                key=session.data["key"],
                title=session.data["title"],
                keywords=session.data["keywords"],
                experience_questions=[session.data["question"]],
                notes=notes,
                created_by=str(session.user_id)
            )

            end_training_session(session.user_id)

            if success:
                return f"""
Role **{session.data['title']}** added successfully!

Key: {session.data['key']}
Keywords: {', '.join(session.data['keywords'])}
Question: {session.data['question']}

Use /refresh_kb to load the updated knowledgebase.
Use /add_role to add another role.
"""
            else:
                return "Failed to save role. Please try again."

        except Exception as e:
            end_training_session(session.user_id)
            return f"Error saving role: {e}"

    return "Unknown step. Use /train_exit to restart."


async def process_add_faq_step(session: TrainingSession, text: str) -> str:
    """Process steps for adding a new FAQ."""
    text = text.strip()

    if session.step == 1:
        # Get FAQ key
        session.data["key"] = text.lower().replace(" ", "_")
        session.step = 2
        return f"""
FAQ key: **{session.data['key']}**

Step 2/3: What's the question?
(e.g., "What is the pay rate?")
"""

    elif session.step == 2:
        # Get question
        session.data["question"] = text
        session.step = 3
        return f"""
Question: "{session.data['question']}"

Step 3/3: What's the answer?
"""

    elif session.step == 3:
        # Get answer and save
        session.data["answer"] = text

        try:
            from .knowledgebase_db import add_faq

            success = await add_faq(
                key=session.data["key"],
                question=session.data["question"],
                answer=session.data["answer"],
                created_by=str(session.user_id)
            )

            end_training_session(session.user_id)

            if success:
                return f"""
FAQ **{session.data['key']}** added successfully!

Q: {session.data['question']}
A: {session.data['answer']}

Use /refresh_kb to load the updated knowledgebase.
Use /add_faq to add another FAQ.
"""
            else:
                return "Failed to save FAQ. Please try again."

        except Exception as e:
            end_training_session(session.user_id)
            return f"Error saving FAQ: {e}"

    return "Unknown step. Use /train_exit to restart."


# =============================================================================
# MAIN HANDLER
# =============================================================================

async def handle_training_message(user_id: int, username: str, text: str) -> Optional[str]:
    """
    Main handler for training-related messages.

    Returns response string if message was handled, None if should be
    processed normally.
    """
    # Initialize admin users on first call
    if not ADMIN_USER_IDS:
        init_admin_users()

    # Check if it's a training command
    if text.startswith("/train"):
        if text == "/train":
            return await handle_train_command(user_id, username)
        elif text == "/train_exit":
            return await handle_train_exit(user_id)

    # Check other training commands (only for admins)
    if text.startswith("/add_role"):
        return await handle_add_role_command(user_id)
    elif text.startswith("/add_faq"):
        return await handle_add_faq_command(user_id)
    elif text.startswith("/list_roles"):
        return await handle_list_roles_command()
    elif text.startswith("/list_faqs"):
        return await handle_list_faqs_command()
    elif text.startswith("/list_all"):
        return await handle_list_all_command()
    elif text.startswith("/delete "):
        args = text[8:]  # Remove "/delete "
        return await handle_delete_command(user_id, args)
    elif text.startswith("/refresh_kb"):
        return await handle_refresh_command(user_id)
    elif text.startswith("/seed_kb"):
        return await handle_seed_command(user_id)
    elif text.startswith("/export_kb"):
        return await handle_export_command(user_id)

    # Check if user is in training mode
    if is_in_training_mode(user_id):
        return await process_training_input(user_id, text)

    # Not a training message
    return None
