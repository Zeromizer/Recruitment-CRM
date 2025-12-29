-- Migration: Create knowledgebase table for dynamic AI chatbot training
-- Run this in Supabase SQL Editor

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

-- Allow all operations (the bot uses service key)
CREATE POLICY "Allow all knowledgebase operations" ON knowledgebase FOR ALL USING (true);

-- Trigger to update updated_at timestamp
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

-- Add comment for documentation
COMMENT ON TABLE knowledgebase IS 'Stores dynamic knowledge entries for AI chatbot training. Categories: company, role, faq, style, objective, phrase';
COMMENT ON COLUMN knowledgebase.category IS 'Type of knowledge: company, role, faq, style, objective, phrase';
COMMENT ON COLUMN knowledgebase.key IS 'Unique identifier within category (e.g., "barista", "pay_rate")';
COMMENT ON COLUMN knowledgebase.value IS 'JSON data for the entry (structure varies by category)';
COMMENT ON COLUMN knowledgebase.created_by IS 'User ID or name of who created this entry';
COMMENT ON COLUMN knowledgebase.is_active IS 'Soft delete flag - inactive entries are ignored';
