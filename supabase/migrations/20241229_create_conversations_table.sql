-- Migration: Create conversations table for persistent chat history
-- Run this in Supabase SQL Editor

-- Conversations table stores individual messages
CREATE TABLE IF NOT EXISTS conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Platform identification
    platform TEXT NOT NULL CHECK (platform IN ('telegram', 'whatsapp')),
    platform_user_id TEXT NOT NULL,  -- telegram_user_id or whatsapp_phone

    -- Optional link to candidate (set when candidate is created)
    candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,

    -- Message data
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,

    -- Metadata
    message_metadata JSONB DEFAULT '{}'::jsonb  -- For file info, etc.
);

-- Conversation state table (tracks conversation progress)
CREATE TABLE IF NOT EXISTS conversation_states (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Platform identification (unique per user per platform)
    platform TEXT NOT NULL CHECK (platform IN ('telegram', 'whatsapp')),
    platform_user_id TEXT NOT NULL,

    -- Link to candidate
    candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,

    -- Conversation state
    stage TEXT DEFAULT 'initial',
    candidate_name TEXT,
    applied_role TEXT,
    citizenship_status TEXT,
    form_completed BOOLEAN DEFAULT FALSE,
    resume_received BOOLEAN DEFAULT FALSE,
    experience_discussed BOOLEAN DEFAULT FALSE,
    call_scheduled BOOLEAN DEFAULT FALSE,

    -- Additional state data
    state_data JSONB DEFAULT '{}'::jsonb,

    UNIQUE(platform, platform_user_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversations_platform_user
    ON conversations(platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_candidate
    ON conversations(candidate_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created
    ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_states_platform_user
    ON conversation_states(platform, platform_user_id);

-- Enable Row Level Security
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;

-- Allow all operations (the bot uses service key)
CREATE POLICY "Allow all conversations operations"
    ON conversations FOR ALL USING (true);
CREATE POLICY "Allow all conversation_states operations"
    ON conversation_states FOR ALL USING (true);

-- Trigger to update updated_at timestamp on conversation_states
CREATE OR REPLACE FUNCTION update_conversation_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_conversation_states_timestamp ON conversation_states;
CREATE TRIGGER update_conversation_states_timestamp
    BEFORE UPDATE ON conversation_states
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_states_updated_at();

-- Helper function to get conversation history for a user
CREATE OR REPLACE FUNCTION get_conversation_history(
    p_platform TEXT,
    p_platform_user_id TEXT,
    p_limit INT DEFAULT 50
)
RETURNS TABLE (
    role TEXT,
    content TEXT,
    created_at TIMESTAMPTZ,
    message_metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.role, c.content, c.created_at, c.message_metadata
    FROM conversations c
    WHERE c.platform = p_platform
      AND c.platform_user_id = p_platform_user_id
    ORDER BY c.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Helper function to delete all conversations for a user
CREATE OR REPLACE FUNCTION delete_user_conversations(
    p_platform TEXT,
    p_platform_user_id TEXT
)
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM conversations
    WHERE platform = p_platform
      AND platform_user_id = p_platform_user_id;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    DELETE FROM conversation_states
    WHERE platform = p_platform
      AND platform_user_id = p_platform_user_id;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime for live updates in CRM
-- Note: This adds the tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_states;

-- Comments for documentation
COMMENT ON TABLE conversations IS 'Stores individual chat messages for Telegram and WhatsApp bots';
COMMENT ON TABLE conversation_states IS 'Tracks conversation progress and state for each user';
COMMENT ON COLUMN conversations.platform IS 'Chat platform: telegram or whatsapp';
COMMENT ON COLUMN conversations.platform_user_id IS 'User ID on the platform (telegram_user_id or phone number)';
COMMENT ON COLUMN conversations.candidate_id IS 'Link to candidate record (set after resume submission)';
COMMENT ON COLUMN conversations.message_metadata IS 'Additional data like file names, timestamps, etc.';
