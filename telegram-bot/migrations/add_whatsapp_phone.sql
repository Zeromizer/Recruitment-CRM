-- Migration: Add WhatsApp phone column to candidates table
-- Run this in your Supabase SQL Editor

-- Add whatsapp_phone column if it doesn't exist
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_candidates_whatsapp_phone
ON candidates (whatsapp_phone);

-- Optional: Add a comment for documentation
COMMENT ON COLUMN candidates.whatsapp_phone IS 'WhatsApp phone number for candidates from WhatsApp bot';
