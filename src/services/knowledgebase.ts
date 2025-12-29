import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { JobPost, CompanyProfile, KnowledgebaseEntry } from '../types/botConfig';

// Categories for the knowledgebase table
const CATEGORY_COMPANY = 'company';
const CATEGORY_ROLE = 'role';
const CATEGORY_FAQ = 'faq';
const CATEGORY_STYLE = 'style';
const CATEGORY_OBJECTIVE = 'objective';

// ============================================================================
// JOB POSTS
// ============================================================================

export async function getJobPosts(): Promise<JobPost[]> {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured');
    return [];
  }

  const { data, error } = await supabase
    .from('knowledgebase')
    .select('*')
    .eq('category', CATEGORY_ROLE)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching job posts:', error);
    throw error;
  }

  return (data || []).map((entry: KnowledgebaseEntry) => ({
    id: entry.id,
    key: entry.key,
    is_active: entry.is_active,
    ...entry.value as Omit<JobPost, 'id' | 'key' | 'is_active'>,
  }));
}

export async function getJobPost(key: string): Promise<JobPost | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('knowledgebase')
    .select('*')
    .eq('category', CATEGORY_ROLE)
    .eq('key', key)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return {
    id: data.id,
    key: data.key,
    is_active: data.is_active,
    ...data.value,
  };
}

export async function createJobPost(job: Omit<JobPost, 'id' | 'created_at' | 'updated_at'>): Promise<JobPost> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }

  const { key, is_active, ...value } = job;

  const { data, error } = await supabase
    .from('knowledgebase')
    .insert({
      category: CATEGORY_ROLE,
      key,
      is_active,
      value,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    key: data.key,
    is_active: data.is_active,
    ...data.value,
  };
}

export async function updateJobPost(key: string, updates: Partial<JobPost>): Promise<JobPost> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }

  // Separate is_active from value fields
  const { is_active, key: _, id: __, ...valueUpdates } = updates;

  // First get existing job to merge values
  const existing = await getJobPost(key);
  if (!existing) {
    throw new Error(`Job post "${key}" not found`);
  }

  const updateData: Record<string, unknown> = {};

  if (is_active !== undefined) {
    updateData.is_active = is_active;
  }

  if (Object.keys(valueUpdates).length > 0) {
    // Merge existing value with updates
    const { id: _id, key: _key, is_active: _isActive, ...existingValue } = existing;
    updateData.value = { ...existingValue, ...valueUpdates };
  }

  const { data, error } = await supabase
    .from('knowledgebase')
    .update(updateData)
    .eq('category', CATEGORY_ROLE)
    .eq('key', key)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    key: data.key,
    is_active: data.is_active,
    ...data.value,
  };
}

export async function toggleJobActive(key: string, is_active: boolean): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('knowledgebase')
    .update({ is_active })
    .eq('category', CATEGORY_ROLE)
    .eq('key', key);

  if (error) throw error;
}

export async function deleteJobPost(key: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('knowledgebase')
    .delete()
    .eq('category', CATEGORY_ROLE)
    .eq('key', key);

  if (error) throw error;
}

// ============================================================================
// COMPANY PROFILE
// ============================================================================

export async function getCompanyProfile(): Promise<CompanyProfile | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('knowledgebase')
    .select('*')
    .eq('category', CATEGORY_COMPANY)
    .eq('key', 'profile')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data.value as CompanyProfile;
}

export async function saveCompanyProfile(profile: CompanyProfile): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }

  // Upsert - insert or update
  const { error } = await supabase
    .from('knowledgebase')
    .upsert({
      category: CATEGORY_COMPANY,
      key: 'profile',
      value: profile,
      is_active: true,
    }, {
      onConflict: 'category,key',
    });

  if (error) throw error;
}

// ============================================================================
// COMMUNICATION STYLE
// ============================================================================

export async function getCommunicationStyle(): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('knowledgebase')
    .select('*')
    .eq('category', CATEGORY_STYLE)
    .eq('key', 'communication')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data.value;
}

export async function saveCommunicationStyle(style: Record<string, unknown>): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('knowledgebase')
    .upsert({
      category: CATEGORY_STYLE,
      key: 'communication',
      value: style,
      is_active: true,
    }, {
      onConflict: 'category,key',
    });

  if (error) throw error;
}

// ============================================================================
// CONVERSATION OBJECTIVES
// ============================================================================

export async function getObjectives(): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data, error } = await supabase
    .from('knowledgebase')
    .select('*')
    .eq('category', CATEGORY_OBJECTIVE)
    .eq('key', 'conversation')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data.value;
}

export async function saveObjectives(objectives: Record<string, unknown>): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('knowledgebase')
    .upsert({
      category: CATEGORY_OBJECTIVE,
      key: 'conversation',
      value: objectives,
      is_active: true,
    }, {
      onConflict: 'category,key',
    });

  if (error) throw error;
}

// ============================================================================
// FAQS
// ============================================================================

export async function getFAQs(): Promise<KnowledgebaseEntry[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('knowledgebase')
    .select('*')
    .eq('category', CATEGORY_FAQ)
    .order('key');

  if (error) throw error;

  return data || [];
}

export async function saveFAQ(key: string, value: Record<string, unknown>): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('knowledgebase')
    .upsert({
      category: CATEGORY_FAQ,
      key,
      value,
      is_active: true,
    }, {
      onConflict: 'category,key',
    });

  if (error) throw error;
}

// ============================================================================
// SEED DEFAULT DATA
// ============================================================================

export async function seedDefaultKnowledgebase(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured');
  }

  // Clear existing data first to avoid duplicate key errors
  const { error: deleteError } = await supabase
    .from('knowledgebase')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

  if (deleteError) {
    console.error('Error clearing existing data:', deleteError);
    // Continue anyway - might be empty table
  }

  // Default company profile
  const defaultCompany: CompanyProfile = {
    name: 'CGP',
    full_name: 'CGP Singapore',
    tagline: 'Unleashing Global Talent',
    candidate_tagline: 'Empowering Job Seekers With Career Solutions',
    description: 'CGP Singapore is a leading recruitment agency providing executive search, permanent placement, and staffing solutions across Singapore and Malaysia.',
    ea_licence: '19C9859',
    recruiter_name: 'Ai Wei',
    application_form_url: 'Shorturl.at/kmvJ6',
    locations: {
      singapore: 'Singapore (Primary)',
      malaysia: 'Malaysia (CGP Malaysia)',
    },
    contact: {
      malaysia_phone: '+603 2935 0107',
      website: 'www.cgp.sg',
    },
    social_media: {
      instagram: '@cgp_apac',
      youtube: '@cgpapac',
      linkedin: 'CGP Malaysia',
    },
    services: [
      'Executive Search',
      'Permanent Recruitment',
      'Contract & Temp Staffing',
      'Work Pass Services',
    ],
    industries: [
      'Accounting & Finance',
      'Government, GLC & Public Healthcare',
      'Human Resources',
      'Industrial & Manufacturing',
      'Legal & Compliance',
      'Sales, Marketing & Digital',
      'Supply Chain, Logistics & Shipping',
      'Technology',
      'F&B (Food & Beverage)',
      'Retail',
      'Events & Hospitality',
      'Customer Service',
      'Administrative',
    ],
  };

  await saveCompanyProfile(defaultCompany);

  // Default warehouse packer job
  const defaultJob: Omit<JobPost, 'id' | 'created_at' | 'updated_at'> = {
    key: 'warehouse_packer',
    title: 'Warehouse Operations/Packer',
    is_active: true,
    keywords: ['warehouse', 'packer', 'packing', 'logistics', 'jurong', 'shift', 'operations'],
    salary: '$2,200 - $2,700/month',
    location: '6 Fishery Port Road, Singapore 619747 (Jurong Port)',
    work_type: 'Full-time, 6 days/week',
    shifts: {
      day: '10.00am to 7.00pm',
      overnight: '9.00pm to 6.00am',
    },
    responsibilities: [
      'Select, weigh, pack (wrap), and label fresh fruits and vegetables',
      'Sort various categories of warehouse goods (rice, flour, cooking oil, meat, etc.)',
      'Assist in maintaining warehouse cleanliness, organization, and proper stock arrangement',
      'Perform any other duties assigned by supervisors',
    ],
    requirements: [
      'Singaporeans Only',
      'Basic numerical conversion knowledge (e.g., 1kg = 1000g)',
    ],
    experience_questions: [
      'are u a singaporean?',
      'do u have any warehouse or packing experience?',
      'are u able to do shift work? we have day shift (10am-7pm) or overnight shift (9pm-6am)',
    ],
    key_skills: ['Basic math', 'Physical stamina', 'Attention to detail', 'Able to work shifts'],
    typical_schedule: '6 days/week, day or overnight shifts',
    citizenship_required: 'SC',
    notes: 'Must be Singaporean. Pay up to $2,700/month. Location at Jurong Port.',
  };

  await createJobPost(defaultJob);

  // Default communication style
  const defaultStyle = {
    tone: 'friendly',
    language: 'english',
    formality: 'casual',
    emoji_usage: 'minimal',
    response_length: 'concise',
    message_delay: 'normal',
    custom_phrases: 'Hello! Thanks for reaching out to CGP!\nSounds great, let me help you with that!\nWelcome to CGP Singapore!',
  };

  await saveCommunicationStyle(defaultStyle);

  // Default objectives
  const defaultObjectives = {
    primary_goal: 'Qualify candidates for job openings and collect their contact information for follow-up',
    secondary_goals: 'Answer questions about job requirements\nProvide company information\nSchedule interviews when appropriate',
    conversation_starters: "Hi! I'm the CGP recruitment assistant. Are you looking for a new job opportunity?\nHello! Thanks for reaching out. How can I help you today?\nWelcome to CGP! Are you interested in any of our current job openings?",
    closing_messages: "Great! I've noted your details. Our recruiter will be in touch soon!\nThank you for your interest! We'll review your information and get back to you.\nThanks for chatting! Look out for a call or message from our team.",
    escalation_triggers: 'Candidate requests to speak to a human\nComplex salary negotiation questions\nComplaints or negative feedback\nLegal or contract-related questions',
    success_criteria: 'Candidate provides name and phone number\nCandidate expresses interest in specific job\nCandidate agrees to interview or follow-up call',
  };

  await saveObjectives(defaultObjectives);

  console.log('Default knowledgebase seeded successfully');
}

// ============================================================================
// FULL EXPORT FOR BOT SYNC
// ============================================================================

export async function getFullKnowledgebase(): Promise<Record<string, unknown>> {
  if (!isSupabaseConfigured || !supabase) {
    return {};
  }

  const { data, error } = await supabase
    .from('knowledgebase')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;

  // Group by category
  const result: Record<string, Record<string, unknown>> = {};

  for (const entry of data || []) {
    if (!result[entry.category]) {
      result[entry.category] = {};
    }
    result[entry.category][entry.key] = entry.value;
  }

  return result;
}
