// Bot Configuration Types

export interface JobPost {
  id?: string;
  key: string;
  title: string;
  is_active: boolean;
  keywords: string[];
  salary?: string;
  location?: string;
  work_type?: string;
  shifts?: {
    day?: string;
    overnight?: string;
  };
  responsibilities?: string[];
  requirements?: string[];
  experience_questions: string[];
  key_skills: string[];
  typical_schedule?: string;
  citizenship_required?: 'SC' | 'PR' | 'Any';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyProfile {
  name: string;
  full_name: string;
  tagline: string;
  candidate_tagline: string;
  description: string;
  ea_licence: string;
  recruiter_name: string;
  application_form_url: string;
  locations: {
    singapore: string;
    malaysia?: string;
  };
  contact: {
    phone?: string;
    malaysia_phone?: string;
    website: string;
    email?: string;
  };
  social_media: {
    instagram?: string;
    youtube?: string;
    linkedin?: string;
    facebook?: string;
  };
  services: string[];
  industries: string[];
}

export interface CommunicationStyle {
  personality: {
    tone: string;
    approach: string;
    avoid: string[];
  };
  language_preferences: {
    contractions: Record<string, string>;
    casual_affirmations: string[];
    natural_acknowledgments: string[];
  };
  formatting: {
    message_separator: string;
    max_sentences_per_message: number;
    prefer_short_messages: boolean;
  };
}

export interface ConversationObjective {
  id: string;
  name: string;
  description: string;
  priority: number;
  completion_indicator: string;
  natural_approach: string;
}

export interface ClosingConfig {
  successful_phrase: string;
  incomplete_reminder: string;
  follow_up_triggers: string[];
}

export interface KnowledgebaseEntry {
  id: string;
  category: 'company' | 'role' | 'faq' | 'style' | 'objective';
  key: string;
  value: Record<string, unknown>;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Form state types
export interface JobFormData {
  key: string;
  title: string;
  is_active: boolean;
  keywords: string;
  salary: string;
  location: string;
  work_type: string;
  day_shift: string;
  overnight_shift: string;
  responsibilities: string;
  requirements: string;
  experience_questions: string;
  key_skills: string;
  citizenship_required: 'SC' | 'PR' | 'Any';
  notes: string;
}

export interface CompanyFormData {
  name: string;
  full_name: string;
  tagline: string;
  description: string;
  ea_licence: string;
  recruiter_name: string;
  application_form_url: string;
  website: string;
  phone: string;
  instagram: string;
  linkedin: string;
}
