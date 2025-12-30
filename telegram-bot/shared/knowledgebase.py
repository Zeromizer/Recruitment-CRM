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
COMPANY_FULL_NAME = "CGP Singapore"
EA_LICENCE = "19C9859"
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
    "tagline": "Unleashing Global Talent",
    "candidate_tagline": "Empowering Job Seekers With Career Solutions",
    "description": "CGP Singapore is a leading recruitment agency providing executive search, permanent placement, and staffing solutions across Singapore and Malaysia.",
    "ea_licence": EA_LICENCE,
    "recruiter_name": RECRUITER_NAME,
    "application_form_url": APPLICATION_FORM_URL,
    "locations": {
        "singapore": "Singapore (Primary)",
        "malaysia": "Malaysia (CGP Malaysia)"
    },
    "contact": {
        "malaysia_phone": "+603 2935 0107",
        "website": "www.cgp.sg"
    },
    "social_media": {
        "instagram": "@cgp_apac",
        "youtube": "@cgpapac",
        "linkedin": "CGP Malaysia"
    },
    "services": [
        "Executive Search",
        "Permanent Recruitment",
        "Contract & Temp Staffing",
        "Work Pass Services"
    ],
    "industries": [
        "Accounting & Finance",
        "Government, GLC & Public Healthcare",
        "Human Resources",
        "Industrial & Manufacturing",
        "Legal & Compliance",
        "Sales, Marketing & Digital",
        "Supply Chain, Logistics & Shipping",
        "Technology",
        "F&B (Food & Beverage)",
        "Retail",
        "Events & Hospitality",
        "Customer Service",
        "Administrative"
    ],
    "focus_areas": [
        "Executive-level positions",
        "Permanent placements",
        "Part-time positions",
        "Contract roles",
        "Temp staffing"
    ],
    "requirements": {
        "citizenship": "Singapore Citizens and Permanent Residents preferred for most roles",
        "age": "Varies by role, typically 18+",
        "availability": "Flexible scheduling available for most positions"
    },
    "differentiators": [
        "Regional presence across Singapore and Malaysia",
        "Industry-specialized consultants",
        "Comprehensive work pass assistance",
        "Career guidance and resources including salary guides"
    ]
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
        "what_is_cgp": f"{COMPANY_FULL_NAME} ({COMPANY_NAME}) is a leading recruitment agency in Singapore providing executive search, permanent placement, and staffing solutions. We operate across Singapore and Malaysia with EA Licence {EA_LICENCE}.",
        "types_of_jobs": "We cover a wide range - from executive roles to temp positions across Accounting & Finance, Tech, Legal, HR, Manufacturing, Supply Chain, Sales & Marketing, Government/Healthcare, F&B, Retail, and more.",
        "how_it_works": "You apply through our form, we review your resume, and our specialized consultants match you with suitable opportunities. We'll reach out if there's a good fit.",
        "services_offered": "We provide executive search, permanent recruitment, contract/temp staffing, and work pass services for candidates and employers.",
        "company_locations": "Our main office is in Singapore, and we also operate in Malaysia as CGP Malaysia."
    },
    "application_process": {
        "what_happens_after_apply": "Once you submit your application and resume, our team reviews it. If you're a good fit for any current openings, we'll contact you to discuss next steps.",
        "how_long_to_hear_back": "Usually within a few days if there's a suitable role. If you don't hear back, it might mean there's no immediate match, but we keep profiles on file.",
        "interview_process": "Depends on the role - some clients do phone interviews, others want in-person meetings. We'll brief you on what to expect.",
        "can_apply_multiple": "Yes, you can be considered for multiple roles if you have the relevant experience.",
        "referral_program": "Yes, we have a referral program. Ask your consultant for details on how to refer friends."
    },
    "job_requirements": {
        "citizenship": "Most of our roles require Singapore Citizens or PRs due to work permit regulations. Some positions may consider other work pass holders - we also provide work pass services.",
        "experience_needed": "Varies by role - we have entry-level positions to executive-level roles. We'll match you based on your background and skills.",
        "age_requirement": "Generally 18 and above, though some roles may have different requirements.",
        "availability": "Many positions offer flexible scheduling. Part-time roles typically need a few days per week availability."
    },
    "common_concerns": {
        "pay_rates": "Rates vary by role, industry, and experience. We'll discuss specifics when we have a suitable match for you.",
        "work_schedule": "Most roles offer flexibility. You can indicate your preferred schedule in the application.",
        "how_soon_start": "Depends on the position - some roles need people immediately, others have planned start dates.",
        "salary_guide": "We provide salary guides and career resources to help you understand market rates in your industry."
    },
    "industries": {
        "accounting_finance": "We have roles in accounting, finance, audit, and financial services sectors.",
        "technology": "Tech roles including software development, IT support, data, and digital positions.",
        "legal_compliance": "Legal counsel, compliance officers, paralegals, and regulatory roles.",
        "hr": "Human resources positions from HR executives to recruitment and talent acquisition.",
        "manufacturing": "Industrial and manufacturing roles across various sectors.",
        "supply_chain": "Supply chain, logistics, and shipping industry positions.",
        "sales_marketing": "Sales, marketing, digital marketing, and brand management roles.",
        "government_healthcare": "Government, GLC, and public healthcare sector opportunities."
    }
}


# =============================================================================
# ROLE-SPECIFIC KNOWLEDGE
# =============================================================================

ROLE_KNOWLEDGE = {
    # =========================================================================
    # ACTIVE JOBS - Set is_active: True to enable, False to disable
    # =========================================================================
    "warehouse_packer": {
        "title": "Warehouse Operations/Packer",
        "is_active": True,  # Currently hiring
        "keywords": ["warehouse", "packer", "packing", "logistics", "jurong", "shift", "operations"],
        "salary": "$2,200 - $2,700/month",
        "location": "6 Fishery Port Road, Singapore 619747 (Jurong Port)",
        "work_type": "Full-time, 6 days/week",
        "shifts": {
            "day": "10.00am to 7.00pm",
            "overnight": "9.00pm to 6.00am"
        },
        "responsibilities": [
            "Select, weigh, pack (wrap), and label fresh fruits and vegetables",
            "Sort various categories of warehouse goods (rice, flour, cooking oil, meat, etc.)",
            "Assist in maintaining warehouse cleanliness, organization, and proper stock arrangement",
            "Perform any other duties assigned by supervisors"
        ],
        "requirements": [
            "Singaporeans Only",
            "Basic numerical conversion knowledge (e.g., 1kg = 1000g)"
        ],
        "experience_questions": [
            "are u a singaporean?",
            "do u have any warehouse or packing experience?",
            "are u able to do shift work? we have day shift (10am-7pm) or overnight shift (9pm-6am)"
        ],
        "key_skills": ["Basic math", "Physical stamina", "Attention to detail", "Able to work shifts"],
        "typical_schedule": "6 days/week, day or overnight shifts",
        "citizenship_required": "SC",  # Singaporeans only
        "notes": "Must be Singaporean. Pay up to $2,700/month. Location at Jurong Port."
    },
    # =========================================================================
    # INACTIVE JOBS - Keep for future use, set is_active: True when needed
    # =========================================================================
    "accountant": {
        "title": "Accountant / Finance Professional",
        "is_active": False,
        "keywords": ["accountant", "accounting", "finance", "audit", "cpa", "acca", "financial"],
        "experience_questions": [
            "how many years of accounting experience do u have?",
            "are u familiar with any accounting software like SAP or Oracle?",
            "do u have any professional certifications like CPA or ACCA?"
        ],
        "key_skills": ["Financial reporting", "Accounting software", "Excel", "Audit", "Tax"],
        "typical_schedule": "Full-time office hours",
        "notes": "Professional certifications are valued"
    },
    "hr_professional": {
        "title": "HR Professional",
        "is_active": False,
        "keywords": ["hr", "human resource", "recruitment", "talent", "payroll", "compensation"],
        "experience_questions": [
            "what areas of HR have u worked in?",
            "do u have experience with HRIS systems?",
            "have u handled recruitment or employee relations before?"
        ],
        "key_skills": ["Recruitment", "Employee relations", "HRIS", "Payroll", "Policy"],
        "typical_schedule": "Full-time office hours",
        "notes": "Specialization in specific HR areas is common"
    },
    "legal_professional": {
        "title": "Legal / Compliance Professional",
        "is_active": False,
        "keywords": ["legal", "lawyer", "compliance", "paralegal", "contract", "regulatory"],
        "experience_questions": [
            "what's ur legal background or specialization?",
            "do u have experience in corporate or regulatory compliance?",
            "are u admitted to the Singapore Bar?"
        ],
        "key_skills": ["Legal research", "Contract drafting", "Compliance", "Regulatory"],
        "typical_schedule": "Full-time, may require long hours",
        "notes": "Industry specialization matters"
    },
    "it_professional": {
        "title": "IT / Technology Professional",
        "is_active": False,
        "keywords": ["it", "software", "developer", "tech", "data", "engineer", "programmer", "digital"],
        "experience_questions": [
            "what programming languages or technologies do u work with?",
            "what's ur experience in software development or IT support?",
            "have u worked on any notable projects?"
        ],
        "key_skills": ["Programming", "System administration", "Cloud", "Data analysis"],
        "typical_schedule": "Full-time, some roles offer remote",
        "notes": "Technical skills and portfolio matter"
    },
    "sales_marketing": {
        "title": "Sales / Marketing Professional",
        "is_active": False,
        "keywords": ["sales", "marketing", "business development", "digital marketing", "brand"],
        "experience_questions": [
            "what's ur sales or marketing background?",
            "what industries have u worked in?",
            "do u have experience with digital marketing tools?"
        ],
        "key_skills": ["Sales", "Marketing strategy", "Digital marketing", "CRM"],
        "typical_schedule": "Full-time, may involve travel",
        "notes": "Track record and industry experience valued"
    },
    "supply_chain": {
        "title": "Supply Chain / Logistics Professional",
        "is_active": False,
        "keywords": ["supply chain", "logistics", "procurement", "warehouse", "shipping", "inventory"],
        "experience_questions": [
            "what's ur experience in supply chain or logistics?",
            "have u worked with any ERP or inventory systems?",
            "do u have experience in procurement or vendor management?"
        ],
        "key_skills": ["Logistics", "Procurement", "Inventory management", "ERP systems"],
        "typical_schedule": "Full-time, may involve shifts",
        "notes": "Industry certifications like CSCP are valued"
    },
    "healthcare": {
        "title": "Healthcare Professional",
        "is_active": False,
        "keywords": ["healthcare", "medical", "nurse", "hospital", "clinical", "pharma"],
        "experience_questions": [
            "what's ur healthcare background?",
            "do u have any medical certifications or licenses?",
            "which healthcare settings have u worked in?"
        ],
        "key_skills": ["Clinical skills", "Patient care", "Medical knowledge"],
        "typical_schedule": "Shift-based for clinical roles",
        "notes": "Valid licenses and certifications required"
    },
    "barista": {
        "title": "Barista",
        "is_active": False,
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
        "is_active": False,
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
        "is_active": False,
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
        "is_active": False,
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
        "is_active": False,
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
        "is_active": False,
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
    "fnb_service": {
        "title": "F&B Service Crew",
        "is_active": False,
        "keywords": ["waiter", "waitress", "f&b", "restaurant", "service crew", "food"],
        "experience_questions": [
            "do u have experience in f&b or restaurant service?",
            "are u comfortable working in a fast-paced environment?",
            "do u have food hygiene certification?"
        ],
        "key_skills": ["Customer service", "Food handling", "POS systems", "Teamwork"],
        "typical_schedule": "Shift-based, weekends and evenings",
        "notes": "Food hygiene cert may be required"
    },
    "general": {
        "title": "General Position",
        "is_active": True,  # Always active as fallback
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

def get_active_roles() -> Dict[str, Dict]:
    """Get only active roles (is_active=True), preferring database."""
    # Get all roles from database + static
    all_roles = get_all_roles()
    return {
        key: role for key, role in all_roles.items()
        if role.get("is_active", False) and key != "general"
    }


def identify_role_from_text(text: str) -> Optional[str]:
    """
    Identify the job role from a text message or resume.
    Returns the role key or None if no match found.
    Only matches against ACTIVE roles.
    Uses database roles first, then falls back to static.
    """
    if not text:
        return None

    text_lower = text.lower()

    # Get all roles from database + static
    all_roles = get_all_roles()

    # First, check active roles only
    for role_key, role_info in all_roles.items():
        if role_key == "general":
            continue
        if not role_info.get("is_active", False):
            continue  # Skip inactive roles
        for keyword in role_info.get("keywords", []):
            if keyword.lower() in text_lower:
                return role_key

    return None


def get_experience_question(role_key: str) -> str:
    """Get an appropriate experience question for a role."""
    role = get_role_info(role_key)
    questions = role.get("experience_questions", [])
    if questions:
        # Return the first question (could randomize if desired)
        return questions[0]
    return "what kind of work experience do u have?"


def get_role_info(role_key: str) -> Dict:
    """Get full role information, preferring database."""
    role = get_role_from_db(role_key)
    if role:
        return role
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
        f"- EA Licence: {EA_LICENCE}",
        "- Website: www.cgp.sg for more job listings",
        ""
    ])

    # Active jobs - show details
    active_roles = get_active_roles()
    if active_roles:
        prompt_parts.append("## CURRENT JOB OPENINGS")
        for role_key, role in active_roles.items():
            prompt_parts.append(f"**{role.get('title', role_key)}**")
            if role.get('salary'):
                prompt_parts.append(f"- Pay: {role['salary']}")
            if role.get('location'):
                prompt_parts.append(f"- Location: {role['location']}")
            if role.get('work_type'):
                prompt_parts.append(f"- Type: {role['work_type']}")
            if role.get('shifts'):
                shifts = role['shifts']
                prompt_parts.append(f"- Shifts: Day ({shifts.get('day', 'TBD')}) or Overnight ({shifts.get('overnight', 'TBD')})")
            if role.get('requirements'):
                prompt_parts.append(f"- Requirements: {', '.join(role['requirements'])}")
            if role.get('citizenship_required'):
                cit = role['citizenship_required']
                if cit == "SC":
                    prompt_parts.append("- **IMPORTANT: Singaporeans Only**")
            if role.get('job_url'):
                prompt_parts.append(f"- **Job Posting**: {role['job_url']}")
                prompt_parts.append("  (Share this link with candidates when they ask about the position)")
            prompt_parts.append("")
    else:
        prompt_parts.extend([
            "## CURRENT OPENINGS",
            "- No specific openings at the moment, but collect their info for future opportunities",
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
    global RECRUITER_NAME, COMPANY_NAME, COMPANY_FULL_NAME, APPLICATION_FORM_URL

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
            # Handle bot's format (key='info' and key='recruiter')
            if "info" in kb[CATEGORY_COMPANY]:
                COMPANY_INFO.update(kb[CATEGORY_COMPANY]["info"])
            if "recruiter" in kb[CATEGORY_COMPANY]:
                recruiter_info = kb[CATEGORY_COMPANY]["recruiter"]
                if recruiter_info.get("name"):
                    RECRUITER_NAME = recruiter_info["name"]
                if recruiter_info.get("application_form_url"):
                    APPLICATION_FORM_URL = recruiter_info["application_form_url"]

            # Handle CRM's format (key='profile')
            if "profile" in kb[CATEGORY_COMPANY]:
                profile = kb[CATEGORY_COMPANY]["profile"]
                # Map CRM profile fields to bot's COMPANY_INFO
                COMPANY_INFO.update({
                    "name": profile.get("name", COMPANY_INFO.get("name")),
                    "full_name": profile.get("full_name", COMPANY_INFO.get("full_name")),
                    "description": profile.get("description", COMPANY_INFO.get("description")),
                    "industries": profile.get("industries", COMPANY_INFO.get("industries", [])),
                })
                # Update global variables
                if profile.get("name"):
                    COMPANY_NAME = profile["name"]
                if profile.get("full_name"):
                    COMPANY_FULL_NAME = profile["full_name"]
                if profile.get("recruiter_name"):
                    RECRUITER_NAME = profile["recruiter_name"]
                if profile.get("application_form_url"):
                    APPLICATION_FORM_URL = profile["application_form_url"]

            print("Loaded company info from database")

        # Update communication style if available
        if CATEGORY_STYLE in kb:
            # Handle bot's format (keys: 'personality', 'language', 'formatting')
            for key, value in kb[CATEGORY_STYLE].items():
                if key != "communication":
                    COMMUNICATION_STYLE[key] = value

            # Handle CRM's format (key='communication')
            if "communication" in kb[CATEGORY_STYLE]:
                crm_style = kb[CATEGORY_STYLE]["communication"]
                # Map CRM style fields to bot's COMMUNICATION_STYLE
                COMMUNICATION_STYLE["personality"] = {
                    "tone": crm_style.get("tone", "friendly"),
                    "approach": crm_style.get("formality", "casual"),
                }
                COMMUNICATION_STYLE["crm_settings"] = crm_style  # Store full CRM settings

            print("Loaded communication style from database")

        # Update objectives if available
        if CATEGORY_OBJECTIVE in kb:
            # Handle CRM's format (key='conversation')
            if "conversation" in kb[CATEGORY_OBJECTIVE]:
                crm_obj = kb[CATEGORY_OBJECTIVE]["conversation"]
                # Store CRM objectives for reference in system prompt
                CONVERSATION_OBJECTIVES["crm_settings"] = crm_obj
                if crm_obj.get("closing_messages"):
                    # Use first closing message as the closing phrase
                    closing_msgs = crm_obj["closing_messages"].split("\n")
                    if closing_msgs:
                        CONVERSATION_OBJECTIVES["closing_approach"]["phrase"] = closing_msgs[0]

            print("Loaded objectives from database")

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
    """Get all roles, preferring database over static."""
    # If database is loaded, use ONLY database roles + the 'general' fallback
    if _db_loaded and "role" in _db_knowledge:
        db_roles = dict(_db_knowledge["role"])
        # Always include the 'general' fallback role from static
        if "general" in ROLE_KNOWLEDGE:
            db_roles["general"] = ROLE_KNOWLEDGE["general"]
        return db_roles
    # Fallback to static roles only if database not loaded
    return dict(ROLE_KNOWLEDGE)


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
# SEMANTIC SEARCH (RAG) FUNCTIONS
# =============================================================================

async def search_faqs_semantic(query: str, threshold: float = 0.4, limit: int = 3) -> List[Dict]:
    """
    Search FAQs using semantic similarity (RAG).
    Falls back to keyword search if embeddings not available.

    Args:
        query: The user's question
        threshold: Minimum similarity score (0-1)
        limit: Max results to return

    Returns:
        List of FAQ dicts with question, answer, and similarity score
    """
    try:
        from .embeddings import search_faqs
        results = await search_faqs(query, threshold, limit)
        if results:
            return results
    except Exception as e:
        print(f"Semantic FAQ search unavailable: {e}")

    # Fallback to keyword matching
    query_lower = query.lower()
    matches = []

    # Search database FAQs
    if _db_loaded and "faq" in _db_knowledge:
        for key, faq in _db_knowledge["faq"].items():
            question = faq.get("question", "").lower()
            answer = faq.get("answer", "").lower()
            if any(word in question or word in answer for word in query_lower.split()):
                matches.append({
                    "key": key,
                    "question": faq.get("question"),
                    "answer": faq.get("answer"),
                    "similarity": 0.5  # Default score for keyword match
                })

    # Search static FAQs
    for topic, faqs in FAQ_KNOWLEDGE.items():
        for key, value in faqs.items():
            if isinstance(value, str) and query_lower in value.lower():
                matches.append({
                    "key": f"{topic}_{key}",
                    "question": key,
                    "answer": value,
                    "similarity": 0.5
                })

    return matches[:limit]


async def identify_role_semantic(text: str, threshold: float = 0.3) -> Optional[str]:
    """
    Identify job role using semantic similarity (RAG).
    Falls back to keyword matching if embeddings not available.

    Args:
        text: User message or resume text
        threshold: Minimum similarity score

    Returns:
        Role key if found, None otherwise
    """
    try:
        from .embeddings import search_roles
        results = await search_roles(text, threshold, limit=1)
        if results and len(results) > 0:
            return results[0].get("key")
    except Exception as e:
        print(f"Semantic role search unavailable: {e}")

    # Fallback to keyword matching
    return identify_role_from_text(text)


async def search_knowledge_semantic(
    query: str,
    category: str = None,
    threshold: float = 0.4,
    limit: int = 5
) -> List[Dict]:
    """
    Search entire knowledgebase semantically.

    Args:
        query: Search query
        category: Optional category filter
        threshold: Minimum similarity
        limit: Max results

    Returns:
        List of matching knowledge entries
    """
    try:
        from .embeddings import search_similar_knowledge
        results = await search_similar_knowledge(query, category, threshold, limit)
        if results:
            return results
    except Exception as e:
        print(f"Semantic knowledge search unavailable: {e}")

    return []


async def get_relevant_context_for_query(query: str) -> str:
    """
    Get relevant context from knowledgebase for a user query.
    Used to augment AI responses with specific knowledge.

    Args:
        query: The user's message/question

    Returns:
        Formatted context string to include in AI prompt
    """
    context_parts = []

    # Search FAQs
    faqs = await search_faqs_semantic(query, threshold=0.4, limit=2)
    if faqs:
        faq_context = "Relevant FAQs:\n"
        for faq in faqs:
            faq_context += f"- Q: {faq.get('question', 'N/A')}\n  A: {faq.get('answer', 'N/A')}\n"
        context_parts.append(faq_context)

    # Search roles if query seems job-related
    job_keywords = ["job", "work", "position", "role", "apply", "hiring", "vacancy", "opening"]
    if any(kw in query.lower() for kw in job_keywords):
        try:
            from .embeddings import search_roles
            roles = await search_roles(query, threshold=0.3, limit=2)
            if roles:
                role_context = "Relevant job roles:\n"
                for role in roles:
                    role_context += f"- {role.get('title', 'Unknown')}: keywords={role.get('keywords', [])}\n"
                context_parts.append(role_context)
        except Exception:
            pass

    if context_parts:
        return "\n---\nRetrieved Context:\n" + "\n".join(context_parts) + "\n---\n"

    return ""


async def embed_existing_knowledge() -> Dict[str, int]:
    """
    Generate embeddings for all existing knowledgebase entries.
    Call this after running the vector migration.

    Returns:
        Stats dict with processed/failed/skipped counts
    """
    try:
        from .embeddings import embed_all_knowledge
        return await embed_all_knowledge()
    except Exception as e:
        print(f"Error embedding knowledge: {e}")
        return {"processed": 0, "failed": 0, "skipped": 0, "error": str(e)}


# =============================================================================
# BOT CONFIGURATION HELPERS (from CRM)
# =============================================================================

def get_operating_hours_config() -> Dict[str, Any]:
    """
    Get operating hours configuration from CRM settings.

    Returns:
        Dict with keys:
        - enabled: bool (whether operating hours are enforced)
        - start: str (start time in HH:MM format)
        - end: str (end time in HH:MM format)
        - timezone: str (timezone name, e.g., 'Asia/Singapore')
    """
    crm_settings = COMMUNICATION_STYLE.get("crm_settings", {})
    return {
        "enabled": crm_settings.get("operating_hours_enabled", True),
        "start": crm_settings.get("operating_hours_start", "08:30"),
        "end": crm_settings.get("operating_hours_end", "22:00"),
        "timezone": crm_settings.get("operating_hours_timezone", "Asia/Singapore"),
    }


def is_telegram_quote_reply_enabled() -> bool:
    """
    Check if Telegram quote reply is enabled from CRM settings.

    Returns:
        bool: True if quote reply should be used, False otherwise
    """
    crm_settings = COMMUNICATION_STYLE.get("crm_settings", {})
    return crm_settings.get("telegram_quote_reply", True)


def get_message_delay_settings() -> tuple[float, float]:
    """
    Get message delay settings from CRM configuration.

    Returns:
        Tuple of (min_delay, max_delay) in seconds
    """
    crm_settings = COMMUNICATION_STYLE.get("crm_settings", {})
    delay_setting = crm_settings.get("message_delay", "normal")

    # Map CRM delay settings to actual delays (min, max)
    delay_map = {
        "instant": (0.0, 0.0),
        "fast": (0.5, 1.0),
        "normal": (1.5, 3.0),
        "slow": (3.0, 5.0),
        "very_slow": (5.0, 8.0),
    }

    return delay_map.get(delay_setting, (1.5, 3.0))  # Default to normal


# =============================================================================
# EXPORT FOR USE IN AI SCREENING
# =============================================================================

__all__ = [
    # Configuration
    'RECRUITER_NAME',
    'COMPANY_NAME',
    'COMPANY_FULL_NAME',
    'EA_LICENCE',
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

    # Bot Configuration (from CRM)
    'get_operating_hours_config',
    'is_telegram_quote_reply_enabled',
    'get_message_delay_settings',
    'should_ask_citizenship',
    'get_closing_response',
    'get_active_roles',

    # Database integration
    'reload_from_database',
    'is_db_loaded',
    'get_db_knowledge',
    'get_role_from_db',
    'get_all_roles',
    'get_faq_from_db',

    # Semantic search (RAG)
    'search_faqs_semantic',
    'identify_role_semantic',
    'search_knowledge_semantic',
    'get_relevant_context_for_query',
    'embed_existing_knowledge',
]
