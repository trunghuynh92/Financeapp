-- Migration 053: Refresh PostgREST schema cache
-- This migration forces PostgREST to reload the schema cache

-- PostgREST watches for changes in the schema cache
-- We can force a refresh by executing NOTIFY command
NOTIFY pgrst, 'reload schema';

-- Alternative: We can also try signaling via the database config
DO $$
BEGIN
  -- This is a no-op but will trigger schema introspection
  -- when PostgREST next processes a request
  PERFORM pg_notify('pgrst', 'reload config');
END $$;
