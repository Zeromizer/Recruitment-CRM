-- Migration: Auto-cleanup old conversations after 30 days
-- Run this in Supabase SQL Editor

-- Function to delete conversations older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_conversations(days_to_keep INT DEFAULT 30)
RETURNS TABLE (
    deleted_messages INT,
    deleted_states INT
) AS $$
DECLARE
    msg_count INT;
    state_count INT;
    cutoff_date TIMESTAMPTZ;
BEGIN
    cutoff_date := NOW() - (days_to_keep || ' days')::INTERVAL;

    -- Delete old messages
    DELETE FROM conversations
    WHERE created_at < cutoff_date;
    GET DIAGNOSTICS msg_count = ROW_COUNT;

    -- Delete conversation states that have no recent messages
    -- and haven't been updated in the retention period
    DELETE FROM conversation_states
    WHERE updated_at < cutoff_date
      AND NOT EXISTS (
          SELECT 1 FROM conversations c
          WHERE c.platform = conversation_states.platform
            AND c.platform_user_id = conversation_states.platform_user_id
      );
    GET DIAGNOSTICS state_count = ROW_COUNT;

    RETURN QUERY SELECT msg_count, state_count;
END;
$$ LANGUAGE plpgsql;

-- Enable pg_cron extension (may already be enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup to run daily at 3 AM UTC
-- Note: pg_cron jobs run in the 'postgres' database by default
-- You may need to adjust this based on your Supabase setup
SELECT cron.schedule(
    'cleanup-old-conversations',  -- job name
    '0 3 * * *',                  -- cron expression: daily at 3 AM UTC
    $$SELECT cleanup_old_conversations(30)$$
);

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule if needed:
-- SELECT cron.unschedule('cleanup-old-conversations');

-- Manual cleanup command (run anytime):
-- SELECT * FROM cleanup_old_conversations(30);

COMMENT ON FUNCTION cleanup_old_conversations IS 'Deletes conversations and orphaned states older than specified days (default 30)';
