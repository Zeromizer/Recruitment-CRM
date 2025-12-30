-- Create job_scoring table for AI screening criteria
CREATE TABLE IF NOT EXISTS job_scoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title TEXT NOT NULL,
  requirements TEXT NOT NULL,
  scoring_guide TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE job_scoring ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust based on your security needs)
CREATE POLICY "Enable all for authenticated users" ON job_scoring
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_job_scoring_updated_at
  BEFORE UPDATE ON job_scoring
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_job_scoring_job_title ON job_scoring(job_title);

COMMENT ON TABLE job_scoring IS 'AI screening criteria for matching candidates to jobs';
COMMENT ON COLUMN job_scoring.job_title IS 'Job title that matches with job posts';
COMMENT ON COLUMN job_scoring.requirements IS 'Detailed requirements for the position';
COMMENT ON COLUMN job_scoring.scoring_guide IS 'Scoring criteria for AI to evaluate candidates';
