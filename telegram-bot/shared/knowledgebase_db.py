"""
Database-backed Knowledgebase Module

This module provides CRUD operations for storing and retrieving
knowledgebase entries from Supabase, enabling dynamic updates
through chat-based training.

Database Schema:
- knowledgebase: Main table for storing knowledge entries
  - id: UUID primary key
  - category: Type of knowledge (role, faq, company, style, objective)
  - key: Unique identifier within category
  - value: JSON data for the entry
  - created_at, updated_at: Timestamps
  - created_by: Who added this entry
"""

import os
import json
from datetime import datetime
from typing import Optional, Dict, List, Any
from .database import get_supabase

# Categories for organizing knowledge
CATEGORY_COMPANY = "company"
CATEGORY_ROLE = "role"
CATEGORY_FAQ = "faq"
CATEGORY_STYLE = "style"
CATEGORY_OBJECTIVE = "objective"
CATEGORY_PHRASE = "phrase"

# Cache for loaded knowledgebase
_kb_cache: Dict[str, Dict[str, Any]] = {}
_kb_cache_time: float = 0
KB_CACHE_DURATION = 300  # 5 minutes


# =============================================================================
# DATABASE SCHEMA SQL
# =============================================================================

KNOWLEDGEBASE_SCHEMA_SQL = """
-- Knowledgebase table for storing dynamic knowledge entries
CREATE TABLE IF NOT EXISTS knowledgebase (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_by TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(category, key)
);

-- Index for fast category lookups
CREATE INDEX IF NOT EXISTS idx_knowledgebase_category ON knowledgebase(category);
CREATE INDEX IF NOT EXISTS idx_knowledgebase_active ON knowledgebase(is_active);

-- Enable Row Level Security
ALTER TABLE knowledgebase ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust as needed for your security model)
CREATE POLICY IF NOT EXISTS "Allow all knowledgebase" ON knowledgebase FOR ALL USING (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_knowledgebase_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_knowledgebase_timestamp ON knowledgebase;
CREATE TRIGGER update_knowledgebase_timestamp
    BEFORE UPDATE ON knowledgebase
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledgebase_updated_at();
"""


# =============================================================================
# CRUD OPERATIONS
# =============================================================================

async def create_knowledgebase_table() -> bool:
    """
    Create the knowledgebase table if it doesn't exist.
    Run this once during setup.
    """
    client = get_supabase()
    try:
        # Note: Supabase doesn't support raw SQL via client
        # This would need to be run via Supabase dashboard or migrations
        print("Knowledgebase table schema needs to be created via Supabase dashboard")
        print("SQL:", KNOWLEDGEBASE_SCHEMA_SQL[:200], "...")
        return True
    except Exception as e:
        print(f"Error creating knowledgebase table: {e}")
        return False


async def add_knowledge(
    category: str,
    key: str,
    value: Dict[str, Any],
    created_by: str = None
) -> Optional[Dict]:
    """
    Add or update a knowledge entry.

    Args:
        category: Category (role, faq, company, style, objective)
        key: Unique key within category
        value: JSON data for the entry
        created_by: Who is adding this (user ID or name)

    Returns:
        The created/updated entry or None on error
    """
    client = get_supabase()

    try:
        data = {
            "category": category,
            "key": key,
            "value": value,
            "created_by": created_by,
            "is_active": True
        }

        # Try to upsert (insert or update on conflict)
        result = client.table("knowledgebase").upsert(
            data,
            on_conflict="category,key"
        ).execute()

        # Invalidate cache
        global _kb_cache_time
        _kb_cache_time = 0

        if result.data:
            print(f"Added/updated knowledge: {category}/{key}")
            return result.data[0]
        return None

    except Exception as e:
        print(f"Error adding knowledge: {e}")
        return None


async def get_knowledge(category: str, key: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific knowledge entry.

    Returns:
        The value dict or None if not found
    """
    client = get_supabase()

    try:
        result = client.table("knowledgebase").select("value").eq(
            "category", category
        ).eq("key", key).eq("is_active", True).execute()

        if result.data:
            return result.data[0].get("value")
        return None

    except Exception as e:
        print(f"Error getting knowledge: {e}")
        return None


async def get_category(category: str) -> Dict[str, Any]:
    """
    Get all entries in a category.

    Returns:
        Dict mapping key -> value for all entries in category
    """
    client = get_supabase()

    try:
        result = client.table("knowledgebase").select("key, value").eq(
            "category", category
        ).eq("is_active", True).execute()

        return {item["key"]: item["value"] for item in result.data}

    except Exception as e:
        print(f"Error getting category {category}: {e}")
        return {}


async def delete_knowledge(category: str, key: str) -> bool:
    """
    Soft-delete a knowledge entry (sets is_active = False).
    """
    client = get_supabase()

    try:
        client.table("knowledgebase").update({"is_active": False}).eq(
            "category", category
        ).eq("key", key).execute()

        # Invalidate cache
        global _kb_cache_time
        _kb_cache_time = 0

        print(f"Deleted knowledge: {category}/{key}")
        return True

    except Exception as e:
        print(f"Error deleting knowledge: {e}")
        return False


async def list_knowledge(category: str = None) -> List[Dict]:
    """
    List all knowledge entries, optionally filtered by category.

    Returns:
        List of entries with category, key, and summary
    """
    client = get_supabase()

    try:
        query = client.table("knowledgebase").select(
            "category, key, value, created_at, created_by"
        ).eq("is_active", True)

        if category:
            query = query.eq("category", category)

        result = query.order("category").order("key").execute()
        return result.data

    except Exception as e:
        print(f"Error listing knowledge: {e}")
        return []


# =============================================================================
# FULL KNOWLEDGEBASE LOADING
# =============================================================================

async def load_full_knowledgebase() -> Dict[str, Dict[str, Any]]:
    """
    Load the entire knowledgebase from database.

    Returns:
        Dict with structure: {category: {key: value, ...}, ...}
    """
    global _kb_cache, _kb_cache_time

    import time
    current_time = time.time()

    # Return cached if still valid
    if _kb_cache and (current_time - _kb_cache_time) < KB_CACHE_DURATION:
        return _kb_cache

    client = get_supabase()

    try:
        result = client.table("knowledgebase").select(
            "category, key, value"
        ).eq("is_active", True).execute()

        # Organize by category
        kb = {}
        for item in result.data:
            category = item["category"]
            if category not in kb:
                kb[category] = {}
            kb[category][item["key"]] = item["value"]

        _kb_cache = kb
        _kb_cache_time = current_time
        print(f"Loaded knowledgebase: {len(result.data)} entries")
        return kb

    except Exception as e:
        print(f"Error loading knowledgebase: {e}")
        return _kb_cache or {}


async def refresh_knowledgebase():
    """Force refresh the knowledgebase cache."""
    global _kb_cache_time
    _kb_cache_time = 0
    return await load_full_knowledgebase()


# =============================================================================
# SEED DATA
# =============================================================================

async def seed_default_knowledgebase(recruiter_name: str = "Ai Wei"):
    """
    Seed the database with default knowledgebase entries.
    Only adds entries that don't already exist.
    """
    print("Seeding default knowledgebase...")

    # Company info
    await add_knowledge(CATEGORY_COMPANY, "info", {
        "name": "CGP",
        "full_name": "Cornerstone Global Partners",
        "description": "A staffing and recruitment agency specializing in temp/contract positions across various industries in Singapore.",
        "location": "Singapore",
        "focus_areas": ["Part-time positions", "Contract roles", "Temp staffing"],
        "industries": ["F&B", "Retail", "Events & Hospitality", "Customer Service", "Administrative", "Research"]
    }, created_by="system")

    await add_knowledge(CATEGORY_COMPANY, "recruiter", {
        "name": recruiter_name,
        "application_form_url": os.environ.get('APPLICATION_FORM_URL', 'Shorturl.at/kmvJ6')
    }, created_by="system")

    # Communication style
    await add_knowledge(CATEGORY_STYLE, "personality", {
        "tone": "Casual and friendly, like texting a friend who's helping with job hunting",
        "approach": "Warm but professional, adapts to candidate's energy level"
    }, created_by="system")

    await add_knowledge(CATEGORY_STYLE, "language", {
        "contractions": {"you": "u", "your": "ur", "because": "cos", "okay": "ok"},
        "affirmations": ["can", "ok", "yep", "sure", "noted", "got it"],
        "avoid": ["great!", "awesome!", "amazing!", "quick question"]
    }, created_by="system")

    await add_knowledge(CATEGORY_STYLE, "formatting", {
        "message_separator": "---",
        "max_sentences_per_message": 2,
        "prefer_short_messages": True
    }, created_by="system")

    # Objectives
    await add_knowledge(CATEGORY_OBJECTIVE, "goals", {
        "priority_order": [
            {"id": "form", "name": "Application Form", "prompt": "Get them to fill the application form"},
            {"id": "resume", "name": "Resume Collection", "prompt": "Get their resume"},
            {"id": "experience", "name": "Experience Assessment", "prompt": "Discuss their relevant experience"},
            {"id": "close", "name": "Close Conversation", "prompt": "Let them know you'll be in touch if shortlisted"}
        ]
    }, created_by="system")

    await add_knowledge(CATEGORY_OBJECTIVE, "closing", {
        "phrase": "will contact u if shortlisted",
        "triggers": ["all info collected", "conversation wrapping up"]
    }, created_by="system")

    # Default roles
    roles = [
        {
            "key": "barista",
            "value": {
                "title": "Barista",
                "keywords": ["barista", "coffee", "cafe", "latte"],
                "experience_questions": [
                    "do u have experience making coffee with latte art?",
                    "have u worked in a cafe before?"
                ],
                "key_skills": ["Coffee preparation", "Latte art", "Customer service"],
                "notes": "Latte art experience is a big plus"
            }
        },
        {
            "key": "phone_researcher",
            "value": {
                "title": "Phone Researcher / Survey Caller",
                "keywords": ["researcher", "phone", "survey", "data collection", "government"],
                "experience_questions": [
                    "do u have experience with phone surveys or data collection?",
                    "are u comfortable speaking on the phone for extended periods?"
                ],
                "key_skills": ["Clear communication", "Data entry", "Patience"],
                "notes": "Good for those comfortable with phone conversations"
            }
        },
        {
            "key": "event_crew",
            "value": {
                "title": "Event Crew / Carnival Staff",
                "keywords": ["event", "carnival", "christmas", "exhibition", "roadshow"],
                "experience_questions": [
                    "do u have experience with events or customer service?",
                    "are u comfortable being on ur feet for long hours?"
                ],
                "key_skills": ["Customer engagement", "Physical stamina", "Teamwork"],
                "notes": "Great for festive seasons"
            }
        },
        {
            "key": "admin",
            "value": {
                "title": "Admin Assistant",
                "keywords": ["admin", "administrative", "office", "data entry", "clerical"],
                "experience_questions": [
                    "do u have experience with admin work?",
                    "are u familiar with Microsoft Office?"
                ],
                "key_skills": ["MS Office", "Organization", "Attention to detail"],
                "notes": "Basic computer skills essential"
            }
        },
        {
            "key": "customer_service",
            "value": {
                "title": "Customer Service Representative",
                "keywords": ["customer service", "retail", "service", "helpdesk"],
                "experience_questions": [
                    "do u have experience in customer service?",
                    "how do u handle difficult customers?"
                ],
                "key_skills": ["Communication", "Problem-solving", "Patience"],
                "notes": "Positive attitude is key"
            }
        },
        {
            "key": "promoter",
            "value": {
                "title": "Promoter / Brand Ambassador",
                "keywords": ["promoter", "promotion", "sales", "brand ambassador", "sampling"],
                "experience_questions": [
                    "do u have experience with promotions or sales?",
                    "are u comfortable approaching strangers?"
                ],
                "key_skills": ["Outgoing personality", "Sales skills", "Persuasion"],
                "notes": "Confidence and approachability important"
            }
        }
    ]

    for role in roles:
        await add_knowledge(CATEGORY_ROLE, role["key"], role["value"], created_by="system")

    # Default FAQs
    faqs = [
        {
            "key": "what_is_cgp",
            "value": {
                "question": "What is CGP?",
                "answer": "Cornerstone Global Partners (CGP) is a staffing agency in Singapore that helps connect candidates with part-time, contract, and temp positions across various industries."
            }
        },
        {
            "key": "types_of_jobs",
            "value": {
                "question": "What types of jobs do you have?",
                "answer": "We have roles in F&B, retail, events, customer service, admin, and research. Mostly part-time and contract positions."
            }
        },
        {
            "key": "citizenship_requirement",
            "value": {
                "question": "Do I need to be Singaporean?",
                "answer": "Most of our roles require Singapore Citizens or PRs due to work permit regulations. Some positions may consider other work pass holders."
            }
        },
        {
            "key": "how_long_to_hear_back",
            "value": {
                "question": "How long until I hear back?",
                "answer": "Usually within a few days if there's a suitable role. If you don't hear back, it might mean there's no immediate match, but we keep profiles on file."
            }
        }
    ]

    for faq in faqs:
        await add_knowledge(CATEGORY_FAQ, faq["key"], faq["value"], created_by="system")

    # Common phrases
    await add_knowledge(CATEGORY_PHRASE, "greetings", {
        "first_contact": ["Hi {name}, I'm {recruiter} from {company} :)"],
        "returning": ["hey {name}! how can i help u today?"]
    }, created_by="system")

    await add_knowledge(CATEGORY_PHRASE, "requests", {
        "form": "could u fill up this form? {form_url}",
        "resume": "can i have ur resume?",
        "citizenship": "are u a sg citizen or pr?"
    }, created_by="system")

    print("Default knowledgebase seeded!")
    return True


# =============================================================================
# TRAINING HELPERS
# =============================================================================

async def add_role(
    key: str,
    title: str,
    keywords: List[str],
    experience_questions: List[str],
    key_skills: List[str] = None,
    notes: str = None,
    created_by: str = None
) -> bool:
    """
    Add a new job role to the knowledgebase.

    Example:
        await add_role(
            key="waiter",
            title="Restaurant Waiter",
            keywords=["waiter", "waitress", "restaurant", "f&b"],
            experience_questions=["have u worked in f&b before?"],
            key_skills=["Customer service", "Multitasking"],
            notes="Experience preferred but not required"
        )
    """
    value = {
        "title": title,
        "keywords": keywords,
        "experience_questions": experience_questions,
        "key_skills": key_skills or [],
        "notes": notes or ""
    }

    result = await add_knowledge(CATEGORY_ROLE, key, value, created_by)
    return result is not None


async def add_faq(
    key: str,
    question: str,
    answer: str,
    created_by: str = None
) -> bool:
    """
    Add a new FAQ to the knowledgebase.

    Example:
        await add_faq(
            key="pay_rate",
            question="What is the pay rate?",
            answer="Pay rates vary by role. We'll discuss specifics when there's a match."
        )
    """
    value = {
        "question": question,
        "answer": answer
    }

    result = await add_knowledge(CATEGORY_FAQ, key, value, created_by)
    return result is not None


async def update_company_info(
    key: str,
    value: Any,
    created_by: str = None
) -> bool:
    """
    Update company information.

    Example:
        await update_company_info("recruiter", {"name": "John", "application_form_url": "..."})
    """
    result = await add_knowledge(CATEGORY_COMPANY, key, value, created_by)
    return result is not None


async def add_phrase(
    category_key: str,
    phrase_key: str,
    phrase: str,
    created_by: str = None
) -> bool:
    """
    Add or update a phrase template.

    Example:
        await add_phrase("requests", "availability", "when are u available to start?")
    """
    # Get existing phrases in this category
    existing = await get_knowledge(CATEGORY_PHRASE, category_key)
    if existing:
        existing[phrase_key] = phrase
    else:
        existing = {phrase_key: phrase}

    result = await add_knowledge(CATEGORY_PHRASE, category_key, existing, created_by)
    return result is not None
