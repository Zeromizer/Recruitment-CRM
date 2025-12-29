# Shared utilities for Telegram and WhatsApp bots
from .ai_screening import (
    screen_resume, get_ai_response, SCREENING_PROMPT,
    get_conversation, add_message, clear_conversation,
    get_conversation_state, update_conversation_state,
    mark_resume_received, get_resume_response,
    restore_conversation_from_db, persist_conversation,
    init_anthropic
)
from .database import (
    save_candidate, upload_resume_to_storage, init_supabase,
    load_conversation_history, load_conversation_state,
    save_conversation_state, get_candidate_context_summary,
    get_candidate_by_platform_id
)
from .resume_parser import extract_text_from_pdf
from .google_sheets import get_job_roles_from_sheets, init_google_sheets
from .spam_protection import (
    is_rate_limited, contains_spam, is_user_allowed,
    get_blocked_users, get_whitelist_users, is_whitelist_mode
)
from .knowledgebase import (
    RECRUITER_NAME, COMPANY_NAME, APPLICATION_FORM_URL,
    COMPANY_INFO, ROLE_KNOWLEDGE, FAQ_KNOWLEDGE,
    ConversationContext, ConversationStage,
    build_system_prompt, build_context_from_state,
    identify_role_from_text, get_experience_question,
    get_first_contact_response, get_resume_acknowledgment
)

__all__ = [
    # AI Screening
    'screen_resume', 'get_ai_response', 'SCREENING_PROMPT',
    'get_conversation', 'add_message', 'clear_conversation',
    'get_conversation_state', 'update_conversation_state',
    'mark_resume_received', 'get_resume_response',
    'restore_conversation_from_db', 'persist_conversation',
    'init_anthropic',

    # Database
    'save_candidate', 'upload_resume_to_storage', 'init_supabase',
    'load_conversation_history', 'load_conversation_state',
    'save_conversation_state', 'get_candidate_context_summary',
    'get_candidate_by_platform_id',

    # Resume parsing
    'extract_text_from_pdf',

    # Google Sheets
    'get_job_roles_from_sheets', 'init_google_sheets',

    # Spam protection
    'is_rate_limited', 'contains_spam', 'is_user_allowed',
    'get_blocked_users', 'get_whitelist_users', 'is_whitelist_mode',

    # Knowledgebase
    'RECRUITER_NAME', 'COMPANY_NAME', 'APPLICATION_FORM_URL',
    'COMPANY_INFO', 'ROLE_KNOWLEDGE', 'FAQ_KNOWLEDGE',
    'ConversationContext', 'ConversationStage',
    'build_system_prompt', 'build_context_from_state',
    'identify_role_from_text', 'get_experience_question',
    'get_first_contact_response', 'get_resume_acknowledgment'
]
