-- Add input_content column to production_intent_logs table
-- This column stores the full original text for snapshot viewing

ALTER TABLE production_intent_logs 
ADD COLUMN IF NOT EXISTS input_content TEXT;

-- Add comment to column
COMMENT ON COLUMN production_intent_logs.input_content IS 'Full original text analyzed (for snapshot viewing)';

