"""
Knowledgebase Module for AI Chatbot

This module provides a comprehensive knowledge base for the recruitment chatbot,
enabling context-aware, natural conversations without relying on rigid templates.

The knowledgebase includes:
- Company information
- Job roles and requirements
- FAQs and common responses
- Conversation objectives and flow
- Dynamic context building for AI responses

IMPORTANT: This module supports loading from Supabase database for dynamic updates.
Use the training commands in Telegram to add/update knowledge, or call
`await reload_from_database()` to refresh from DB.
"""

import os
import json
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field
from enum import Enum


# =============================================================================
# CONFIGURATION
# =============================================================================

RECRUITER_NAME = os.environ.get('RECRUITER_NAME', 'Ai Wei')
COMPANY_NAME = os.environ.get('COMPANY_NAME', 'CGP')
COMPANY_FULL_NAME = "Cornerstone Global Partners"
APPLICATION_FORM_URL = os.environ.get('APPLICATION_FORM_URL', 'Shorturl.at/kmvJ6')

# Flag to track if we've loaded from database
_db_loaded = False
_db_knowledge: Dict[str, Dict[str, Any]] = {}


# =============================================================================
# COMPANY INFORMATION
# =============================================================================

COMPANY_INFO = {
    "name": COMPANY_NAME,
    "full_name": COMPANY_FULL_NAME,
    "description": "A staffing and recruitment agency specializing in temp/contract positions across various industries in Singapore.",
    "recruiter_name": RECRUITER_NAME,
    "application_form_url": APPLICATION_FORM_URL,
    "location": "Singapore",
    "focus_areas": [
        "Part-time positions",
        "Contract roles",
        "Temp staffing",
        "Entry-level to mid-level positions"
    ],
    "industries": [
        "F&B (Food & Beverage)",
        "Retail",
        "Events & Hospitality",
        "Customer Service",
        "Administrative",
        "Research & Data Collection"
    ],
    "requirements": {
        "citizenship": "Singapore Citizens and Permanent Residents preferred for most roles",
        "age": "Varies by role, typically 18+",
        "availability": "Flexible scheduling available for most positions"
    }
}


# =============================================================================
# CONVERSATION STATES
# =============================================================================

class ConversationStage(Enum):
    """Stages of the recruitment conversation flow."""
    INITIAL_CONTACT = "initial_contact"
    FORM_PENDING = "form_pending"
    FORM_COMPLETED = "form_completed"
    RESUME_PENDING = "resume_pending"
    RESUME_RECEIVED = "resume_received"
    EXPERIENCE_DISCUSSION = "experience_discussion"
    QUALIFICATION_CHECK = "qualification_check"
    CLOSING = "closing"
    FOLLOW_UP = "follow_up"


# =============================================================================
# CONVERSATION OBJECTIVES
# =============================================================================

CONVERSATION_OBJECTIVES = {
    "primary_goals": [
        {
            "id": "collect_application",
            "name": "Application Form Collection",
            "description": "Get the candidate to fill out the application form",
            "priority": 1,
            "completion_indicator": "form_completed",
            "natural_approach": "Mention the form as a quick step to get them into the system"
        },
        {
            "id": "collect_resume",
            "name": "Resume Collection",
            "description": "Obtain the candidate's resume/CV",
            "priority": 2,
            "completion_indicator": "resume_received",
            "natural_approach": "Ask for their resume so you can match them to suitable roles"
        },
        {
            "id": "assess_experience",
            "name": "Experience Assessment",
            "description": "Understand the candidate's relevant experience for the role",
            "priority": 3,
            "completion_indicator": "experience_discussed",
            "natural_approach": "Have a natural conversation about their background and skills"
        },
        {
            "id": "verify_eligibility",
            "name": "Eligibility Verification",
            "description": "Confirm citizenship/PR status and availability",
            "priority": 4,
            "completion_indicator": "eligibility_confirmed",
            "natural_approach": "Casually confirm they're a Singapore Citizen or PR"
        }
    ],
    "closing_approach": {
        "successful": "Let them know you'll review their application and be in touch if shortlisted",
        "incomplete": "Gently remind them of any pending items (form/resume) before wrapping up",
        "phrase": "will contact u if shortlisted"
    }
}


# =============================================================================
# COMMUNICATION STYLE GUIDE
# =============================================================================

COMMUNICATION_STYLE = {
    "personality": {
        "tone": "Casual and friendly, like texting a friend who's helping with job hunting",
        "approach": "Warm but professional, adapts to candidate's energy level",
        "avoid": [
            "Overly enthusiastic exclamations (great!, awesome!, amazing!)",
            "Corporate jargon or stiff formal language",
            "Repetitive filler phrases",
            "Excessive emoji usage",
            "Robotic or scripted responses"
        ]
    },
    "language_preferences": {
        "contractions": {
            "you": "u",
            "your": "ur",
            "because": "cos",
            "okay": "ok",
            "yes": "yep"
        },
        "casual_affirmations": ["can", "ok", "yep", "sure", "noted", "got it"],
        "natural_acknowledgments": ["ah i see", "makes sense", "oh nice", "cool"]
    },
    "formatting": {
        "message_separator": "---",
        "max_sentences_per_message": 2,
        "prefer_short_messages": True,
        "guidelines": [
            "Break long responses into multiple short messages using '---'",
            "Keep each message segment to 1-2 sentences",
            "Match the candidate's message length - if they're brief, be brief"
        ]
    },
    "energy_matching": {
        "brief_candidate": "Give short, direct responses",
        "chatty_candidate": "Feel free to be more conversational",
        "formal_candidate": "Be slightly more professional but still warm",
        "enthusiastic_candidate": "Match their energy positively"
    }
}


# =============================================================================
# FAQ KNOWLEDGE BASE
# =============================================================================

FAQ_KNOWLEDGE = {
    "about_company": {
        "what_is_cgp": f"{COMPANY_FULL_NAME} ({COMPANY_NAME}) is a staffing agency in Singapore that helps connect candidates with part-time, contract, and temp positions across various industries.",
        "types_of_jobs": "We have roles in F&B, retail, events, customer service, admin, and research. Mostly part-time and contract positions.",
        "how_it_works": "You apply through our form, we review your resume, and if there's a good match we'll reach out to discuss opportunities."
    },
    "application_process": {
        "what_happens_after_apply": "Once you submit your application and resume, our team reviews it. If you're a good fit for any current openings, we'll contact you to discuss next steps.",
        "how_long_to_hear_back": "Usually within a few days if there's a suitable role. If you don't hear back, it might mean there's no immediate match, but we keep profiles on file.",
        "interview_process": "Depends on the role - some clients do phone interviews, others want in-person meetings. We'll brief you on what to expect.",
        "can_apply_multiple": "Yes, you can be considered for multiple roles if you have the relevant experience."
    },
    "job_requirements": {
        "citizenship": "Most of our roles require Singapore Citizens or PRs due to work permit regulations. Some positions may consider other work pass holders.",
        "experience_needed": "Varies by role - some are entry-level, others need specific experience. We'll match you based on your background.",
        "age_requirement": "Generally 18 and above, though some roles may have different requirements.",
        "availability": "Many positions offer flexible scheduling. Part-time roles typically need a few days per week availability."
    },
    "common_concerns": {
        "pay_rates": "Rates vary by role and experience. We'll discuss specifics when we have a suitable match for you.",
        "work_schedule": "Most roles offer flexibility. You can indicate your preferred schedule in the application.",
        "how_soon_start": "Depends on the position - some roles need people immediately, others have planned start dates."
    }
}


# =============================================================================
# ROLE-SPECIFIC KNOWLEDGE
# =============================================================================

ROLE_KNOWLEDGE = {
    "barista": {
        "title": "Barista",
        "keywords": ["barista", "coffee", "cafe", "latte"],
        "experience_questions": [
            "do u have experience making coffee with latte art?",
            "have u worked in a cafe before?",
            "are u familiar with espresso machines?"
        ],
        "key_skills": ["Coffee preparation", "Latte art", "Customer service", "Cash handling"],
        "typical_schedule": "Part-time shifts, weekends often required",
        "notes": "Latte art experience is a big plus for most cafe roles"
    },
    "phone_researcher": {
        "title": "Phone Researcher / Survey Caller",
        "keywords": ["researcher", "phone", "survey", "data collection", "government"],
        "experience_questions": [
            "do u have experience with phone surveys or data collection?",
            "have u done any telemarketing or customer calls before?",
            "are u comfortable speaking on the phone for extended periods?"
        ],
        "key_skills": ["Clear communication", "Data entry", "Patience", "Good phone manner"],
        "typical_schedule": "Flexible hours, can be done from office",
        "notes": "Good for those who are comfortable with phone conversations"
    },
    "event_crew": {
        "title": "Event Crew / Carnival Staff",
        "keywords": ["event", "carnival", "christmas", "exhibition", "roadshow"],
        "experience_questions": [
            "do u have experience with events or customer service?",
            "have u worked at roadshows or exhibitions before?",
            "are u comfortable being on ur feet for long hours?"
        ],
        "key_skills": ["Customer engagement", "Physical stamina", "Teamwork", "Flexibility"],
        "typical_schedule": "Project-based, often weekends and holidays",
        "notes": "Great for earning extra during festive seasons"
    },
    "admin_assistant": {
        "title": "Admin Assistant",
        "keywords": ["admin", "administrative", "office", "data entry", "clerical"],
        "experience_questions": [
            "do u have experience with admin work?",
            "are u familiar with Microsoft Office?",
            "have u done data entry or filing before?"
        ],
        "key_skills": ["MS Office", "Organization", "Attention to detail", "Filing"],
        "typical_schedule": "Usually office hours, can be part-time or full-time",
        "notes": "Basic computer skills are essential"
    },
    "customer_service": {
        "title": "Customer Service Representative",
        "keywords": ["customer service", "retail", "service", "helpdesk", "support"],
        "experience_questions": [
            "do u have experience in customer service?",
            "have u worked in retail before?",
            "how do u handle difficult customers?"
        ],
        "key_skills": ["Communication", "Problem-solving", "Patience", "Product knowledge"],
        "typical_schedule": "Shift-based, including weekends",
        "notes": "Positive attitude is key"
    },
    "promoter": {
        "title": "Promoter / Brand Ambassador",
        "keywords": ["promoter", "promotion", "sales", "brand ambassador", "sampling"],
        "experience_questions": [
            "do u have experience with promotions or sales?",
            "are u comfortable approaching strangers?",
            "have u done any product sampling before?"
        ],
        "key_skills": ["Outgoing personality", "Sales skills", "Persuasion", "Appearance"],
        "typical_schedule": "Project-based, often weekends at malls",
        "notes": "Confidence and approachability are important"
    },
    "general": {
        "title": "General Position",
        "keywords": [],
        "experience_questions": [
            "what kind of work experience do u have?",
            "what roles are u interested in?",
            "what's ur availability like?"
        ],
        "key_skills": [],
        "typical_schedule": "Varies",
        "notes": "Used when no specific role is identified"
    }
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def identify_role_from_text(text: str) -> Optional[str]:
    """
    Identify the job role from a text message or resume.
    Returns the role key or None if no match found.
    """
    if not text:
        return None

    text_lower = text.lower()

    for role_key, role_info in ROLE_KNOWLEDGE.items():
        if role_key == "general":
            continue
        for keyword in role_info.get("keywords", []):
            if keyword in text_lower:
                return role_key

    return None


def get_experience_question(role_key: str) -> str:
    """Get an appropriate experience question for a role."""
    role = ROLE_KNOWLEDGE.get(role_key, ROLE_KNOWLEDGE["general"])
    questions = role.get("experience_questions", [])
    if questions:
        # Return the first question (could randomize if desired)
        return questions[0]
    return "what kind of work experience do u have?"


def get_role_info(role_key: str) -> Dict:
    """Get full role information."""
    return ROLE_KNOWLEDGE.get(role_key, ROLE_KNOWLEDGE["general"])


def get_faq_response(topic: str, question_key: str) -> Optional[str]:
    """Get a FAQ response for a specific topic and question."""
    topic_data = FAQ_KNOWLEDGE.get(topic, {})
    return topic_data.get(question_key)


# =============================================================================
# CONTEXT BUILDER
# =============================================================================

@dataclass
class ConversationContext:
    """Represents the current state and context of a conversation."""
    user_id: str
    candidate_name: Optional[str] = None
    applied_role: Optional[str] = None
    form_completed: bool = False
    resume_received: bool = False
    experience_discussed: bool = False
    eligibility_confirmed: bool = False
    citizenship_status: Optional[str] = None
    stage: ConversationStage = ConversationStage.INITIAL_CONTACT
    key_info: Dict[str, Any] = field(default_factory=dict)
    conversation_history_summary: Optional[str] = None

    def get_pending_objectives(self) -> List[Dict]:
        """Get list of objectives that haven't been completed."""
        pending = []
        for obj in CONVERSATION_OBJECTIVES["primary_goals"]:
            indicator = obj["completion_indicator"]
            if indicator == "form_completed" and not self.form_completed:
                pending.append(obj)
            elif indicator == "resume_received" and not self.resume_received:
                pending.append(obj)
            elif indicator == "experience_discussed" and not self.experience_discussed:
                pending.append(obj)
            elif indicator == "eligibility_confirmed" and not self.eligibility_confirmed:
                pending.append(obj)
        return pending

    def get_next_objective(self) -> Optional[Dict]:
        """Get the next priority objective to work towards."""
        pending = self.get_pending_objectives()
        if pending:
            return min(pending, key=lambda x: x["priority"])
        return None

    def is_ready_to_close(self) -> bool:
        """Check if all primary objectives are complete."""
        return (self.form_completed and
                self.resume_received and
                self.experience_discussed)


def build_system_prompt(context: ConversationContext) -> str:
    """
    Build a dynamic system prompt based on conversation context.
    This replaces the static SYSTEM_PROMPT with context-aware instructions.
    """

    # Base identity
    prompt_parts = [
        f"You are {RECRUITER_NAME}, a recruiter at {COMPANY_FULL_NAME} ({COMPANY_NAME}).",
        "",
        "## YOUR ROLE",
        f"You're helping candidates find suitable part-time and contract positions in Singapore. You work for {COMPANY_NAME}, a staffing agency.",
        ""
    ]

    # Communication style
    prompt_parts.extend([
        "## HOW TO COMMUNICATE",
        f"- Be {COMMUNICATION_STYLE['personality']['tone']}",
        "- Use casual language: 'u' instead of 'you', 'ur' instead of 'your', 'cos' instead of 'because'",
        "- Match the candidate's energy - if they're brief, be brief. If chatty, be more conversational",
        "- Keep responses natural and conversational, not scripted",
        "",
        "## MESSAGE FORMAT",
        "- Use '---' to split into multiple short messages (1-2 sentences each)",
        "- Less is more - don't over-explain",
        "- Example format:",
        '"got it!"',
        "---",
        '"are u a sg citizen or pr?"',
        ""
    ])

    # Current candidate context
    prompt_parts.append("## ABOUT THIS CANDIDATE")
    if context.candidate_name:
        prompt_parts.append(f"- Name: {context.candidate_name}")
    if context.applied_role:
        role_info = get_role_info(context.applied_role)
        prompt_parts.append(f"- Interested in: {role_info.get('title', context.applied_role)}")
    if context.citizenship_status:
        prompt_parts.append(f"- Citizenship: {context.citizenship_status}")

    # What they've done
    completed = []
    if context.form_completed:
        completed.append("filled the application form")
    if context.resume_received:
        completed.append("sent their resume")
    if context.experience_discussed:
        completed.append("discussed their experience")
    if completed:
        prompt_parts.append(f"- Already done: {', '.join(completed)}")
    prompt_parts.append("")

    # Current objectives
    next_obj = context.get_next_objective()
    if next_obj:
        prompt_parts.extend([
            "## YOUR CURRENT FOCUS",
            f"- {next_obj['description']}",
            f"- Approach: {next_obj['natural_approach']}",
            ""
        ])
    elif context.is_ready_to_close():
        prompt_parts.extend([
            "## YOUR CURRENT FOCUS",
            "- All main info collected - can wrap up the conversation",
            f"- Use: \"{CONVERSATION_OBJECTIVES['closing_approach']['phrase']}\"",
            ""
        ])

    # Things to avoid
    prompt_parts.extend([
        "## DON'T",
        "- Repeat information they already told you",
        "- Ask for things they've already provided (form/resume)",
        "- Be overly enthusiastic with exclamation marks",
        "- Promise to call them - just say you'll be in touch if shortlisted",
        "- Send very long messages - keep it casual and brief",
        ""
    ])

    # Knowledge they can reference
    prompt_parts.extend([
        "## WHAT YOU KNOW",
        f"- Application form: {APPLICATION_FORM_URL} (select '{RECRUITER_NAME}' as consultant)",
        f"- Company: {COMPANY_INFO['description']}",
        "- Most roles need Singapore Citizens or PRs",
        "- You handle part-time and contract positions",
        ""
    ])

    return "\n".join(prompt_parts)


def build_context_from_state(user_id: str, state: Dict) -> ConversationContext:
    """
    Build a ConversationContext from a state dictionary.
    Used to convert the existing state tracking to the new context system.
    """
    context = ConversationContext(user_id=user_id)

    if state:
        context.candidate_name = state.get("candidate_name")
        context.form_completed = state.get("form_completed", False)
        context.resume_received = state.get("resume_received", False)
        context.experience_discussed = state.get("experience_discussed", False)
        context.eligibility_confirmed = state.get("call_scheduled", False)  # Legacy mapping

        # Map applied role to our role keys
        applied_role = state.get("applied_role", "")
        if applied_role:
            role_key = identify_role_from_text(applied_role)
            context.applied_role = role_key or "general"

        # Map stage
        stage_str = state.get("stage", "new")
        stage_mapping = {
            "new": ConversationStage.INITIAL_CONTACT,
            "form_sent": ConversationStage.FORM_PENDING,
            "form_completed": ConversationStage.FORM_COMPLETED,
            "resume_requested": ConversationStage.RESUME_PENDING,
            "resume_received": ConversationStage.RESUME_RECEIVED,
            "experience_asked": ConversationStage.EXPERIENCE_DISCUSSION,
            "call_scheduling": ConversationStage.CLOSING,
            "conversation_closed": ConversationStage.CLOSING
        }
        context.stage = stage_mapping.get(stage_str, ConversationStage.INITIAL_CONTACT)

    return context


# =============================================================================
# RESPONSE GENERATION HELPERS
# =============================================================================

def get_first_contact_response(candidate_name: Optional[str] = None) -> str:
    """
    Generate a natural first response when a candidate initiates contact.
    This replaces the FIRST_REPLY_TEMPLATE with a more contextual approach.
    """
    name = candidate_name or "there"

    # Build a natural multi-part greeting
    parts = [
        f"Hi {name}, I'm {RECRUITER_NAME} from {COMPANY_NAME} :)",
        "---",
        f"Could u fill up this quick form for me? {APPLICATION_FORM_URL}",
        "---",
        f"Just select '{RECRUITER_NAME}' as the consultant",
        "---",
        "Let me know once ur done and send me ur resume too"
    ]

    return "\n".join(parts)


def get_resume_acknowledgment(candidate_name: str, role_key: Optional[str] = None) -> str:
    """
    Generate a response when a resume is received.
    """
    first_name = candidate_name.split()[0] if candidate_name else "there"

    # Get role-specific question
    if role_key:
        question = get_experience_question(role_key)
    else:
        question = "what kind of work are u looking for?"

    return f"thanks {first_name}!\n---\n{question}"


def should_ask_citizenship(context: ConversationContext) -> bool:
    """
    Determine if we should ask about citizenship status.
    """
    return (
        not context.citizenship_status and
        not context.eligibility_confirmed and
        (context.resume_received or context.experience_discussed)
    )


def get_closing_response() -> str:
    """Generate a natural closing response."""
    return CONVERSATION_OBJECTIVES["closing_approach"]["phrase"]


# =============================================================================
# DATABASE INTEGRATION
# =============================================================================

async def reload_from_database() -> bool:
    """
    Reload knowledgebase from Supabase database.

    This function loads all knowledge entries from the database and
    updates the module-level dictionaries (ROLE_KNOWLEDGE, FAQ_KNOWLEDGE, etc.)

    Call this on bot startup or when you want to refresh knowledge.

    Returns:
        True if successful, False on error
    """
    global _db_loaded, _db_knowledge, ROLE_KNOWLEDGE, FAQ_KNOWLEDGE
    global COMPANY_INFO, COMMUNICATION_STYLE, CONVERSATION_OBJECTIVES
    global RECRUITER_NAME, COMPANY_NAME, APPLICATION_FORM_URL

    try:
        from .knowledgebase_db import (
            load_full_knowledgebase,
            CATEGORY_COMPANY, CATEGORY_ROLE, CATEGORY_FAQ,
            CATEGORY_STYLE, CATEGORY_OBJECTIVE, CATEGORY_PHRASE
        )

        # Load all knowledge from database
        kb = await load_full_knowledgebase()

        if not kb:
            print("No knowledgebase entries in database, using defaults")
            return False

        _db_knowledge = kb

        # Update roles if available
        if CATEGORY_ROLE in kb:
            ROLE_KNOWLEDGE.update(kb[CATEGORY_ROLE])
            print(f"Loaded {len(kb[CATEGORY_ROLE])} roles from database")

        # Update FAQs if available
        if CATEGORY_FAQ in kb:
            for key, value in kb[CATEGORY_FAQ].items():
                # Map to expected structure
                topic = "common_concerns"  # Default topic
                if "company" in value.get("question", "").lower():
                    topic = "about_company"
                elif "apply" in value.get("question", "").lower() or "process" in value.get("question", "").lower():
                    topic = "application_process"
                elif "require" in value.get("question", "").lower() or "need" in value.get("question", "").lower():
                    topic = "job_requirements"

                if topic not in FAQ_KNOWLEDGE:
                    FAQ_KNOWLEDGE[topic] = {}
                FAQ_KNOWLEDGE[topic][key] = value.get("answer", "")
            print(f"Loaded {len(kb[CATEGORY_FAQ])} FAQs from database")

        # Update company info if available
        if CATEGORY_COMPANY in kb:
            if "info" in kb[CATEGORY_COMPANY]:
                COMPANY_INFO.update(kb[CATEGORY_COMPANY]["info"])
            if "recruiter" in kb[CATEGORY_COMPANY]:
                recruiter_info = kb[CATEGORY_COMPANY]["recruiter"]
                if recruiter_info.get("name"):
                    RECRUITER_NAME = recruiter_info["name"]
                if recruiter_info.get("application_form_url"):
                    APPLICATION_FORM_URL = recruiter_info["application_form_url"]
            print("Loaded company info from database")

        # Update communication style if available
        if CATEGORY_STYLE in kb:
            for key, value in kb[CATEGORY_STYLE].items():
                COMMUNICATION_STYLE[key] = value
            print("Loaded communication style from database")

        _db_loaded = True
        print("Knowledgebase successfully loaded from database")
        return True

    except ImportError as e:
        print(f"Database module not available: {e}")
        return False
    except Exception as e:
        print(f"Error loading knowledgebase from database: {e}")
        return False


def is_db_loaded() -> bool:
    """Check if knowledgebase has been loaded from database."""
    return _db_loaded


def get_db_knowledge() -> Dict[str, Dict[str, Any]]:
    """Get the raw database knowledge (for debugging/inspection)."""
    return _db_knowledge


# Dynamic getters that check database first
def get_role_from_db(role_key: str) -> Optional[Dict]:
    """Get role info, preferring database version if available."""
    if _db_loaded and "role" in _db_knowledge:
        if role_key in _db_knowledge["role"]:
            return _db_knowledge["role"][role_key]
    return ROLE_KNOWLEDGE.get(role_key)


def get_all_roles() -> Dict[str, Dict]:
    """Get all roles, merging database and static."""
    roles = dict(ROLE_KNOWLEDGE)  # Start with static
    if _db_loaded and "role" in _db_knowledge:
        roles.update(_db_knowledge["role"])  # Database overrides
    return roles


def get_faq_from_db(key: str) -> Optional[str]:
    """Get FAQ answer, preferring database version if available."""
    if _db_loaded and "faq" in _db_knowledge:
        if key in _db_knowledge["faq"]:
            return _db_knowledge["faq"][key].get("answer")
    # Search in static FAQ
    for topic in FAQ_KNOWLEDGE.values():
        if key in topic:
            return topic[key]
    return None


# =============================================================================
# EXPORT FOR USE IN AI SCREENING
# =============================================================================

__all__ = [
    # Configuration
    'RECRUITER_NAME',
    'COMPANY_NAME',
    'COMPANY_FULL_NAME',
    'APPLICATION_FORM_URL',

    # Knowledge
    'COMPANY_INFO',
    'CONVERSATION_OBJECTIVES',
    'COMMUNICATION_STYLE',
    'FAQ_KNOWLEDGE',
    'ROLE_KNOWLEDGE',

    # Classes
    'ConversationStage',
    'ConversationContext',

    # Functions
    'identify_role_from_text',
    'get_experience_question',
    'get_role_info',
    'get_faq_response',
    'build_system_prompt',
    'build_context_from_state',
    'get_first_contact_response',
    'get_resume_acknowledgment',
    'should_ask_citizenship',
    'get_closing_response',

    # Database integration
    'reload_from_database',
    'is_db_loaded',
    'get_db_knowledge',
    'get_role_from_db',
    'get_all_roles',
    'get_faq_from_db',
]
