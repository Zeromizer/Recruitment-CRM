import { createClient } from '@supabase/supabase-js';

// Re-export demo data from dedicated file
export { demoCandidates, demoActivities, demoInterviews } from './demoData';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key'
);

// Create Supabase client (will be null if not configured)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Database schema SQL for Settings page
export const DATABASE_SCHEMA_SQL = `-- Candidates table
CREATE TABLE candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  date_received TIMESTAMPTZ DEFAULT NOW(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT,
  applied_role TEXT,
  ai_score INTEGER CHECK (ai_score >= 1 AND ai_score <= 10),
  ai_category TEXT,
  citizenship_status TEXT,
  ai_summary TEXT,
  ai_reasoning TEXT,
  resume_url TEXT,
  current_status TEXT DEFAULT 'new_application',
  assigned_recruiter TEXT,
  matched_roles TEXT[],
  client_submitted_to TEXT,
  submission_date DATE,
  interview_date DATE,
  interview_outcome TEXT,
  offer_date DATE,
  offer_status TEXT,
  start_date DATE,
  contract_end_date DATE,
  hourly_rate DECIMAL,
  bill_rate DECIMAL,
  placement_status TEXT,
  notes TEXT,
  last_contact_date DATE,
  next_action TEXT,
  next_action_date DATE
);

-- Activities table
CREATE TABLE activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  candidate_name TEXT,
  activity_date TIMESTAMPTZ DEFAULT NOW(),
  activity_type TEXT,
  direction TEXT,
  channel TEXT,
  subject TEXT,
  details TEXT,
  related_job TEXT,
  related_client TEXT,
  outcome TEXT,
  follow_up_required BOOLEAN DEFAULT FALSE,
  follow_up_date DATE,
  follow_up_action TEXT,
  logged_by TEXT
);

-- Interviews table
CREATE TABLE interviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
  candidate_name TEXT,
  client_company TEXT,
  job_role TEXT,
  interview_round TEXT,
  interview_type TEXT,
  interview_date DATE,
  interview_time TIME,
  duration_minutes INTEGER DEFAULT 60,
  location TEXT,
  interviewer_name TEXT,
  interviewer_title TEXT,
  prep_notes_sent BOOLEAN DEFAULT FALSE,
  candidate_confirmed BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Scheduled',
  outcome TEXT,
  client_feedback TEXT,
  candidate_feedback TEXT,
  next_steps TEXT,
  notes TEXT
);

-- Enable Row Level Security
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for authenticated users)
CREATE POLICY "Allow all for authenticated users" ON candidates FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON activities FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON interviews FOR ALL USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;
