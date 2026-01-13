-- Drop the updated_at trigger and function from banking.import_sessions
-- This trigger was referencing a column that doesn't exist

-- Drop the trigger first (actual name from database)
DROP TRIGGER IF EXISTS trg_import_sessions_touch_updated_at ON banking.import_sessions;

-- Drop the function with CASCADE to remove all dependent objects
DROP FUNCTION IF EXISTS banking.touch_updated_at() CASCADE;

-- Comments
COMMENT ON SCHEMA banking IS 'Banking module - trigger cleanup completed';
