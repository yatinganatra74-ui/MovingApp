/*
  # Add sent_at field to groupage_quotes

  1. Changes
    - Add sent_at timestamp field to track when quote was emailed
    - Add accepted_at timestamp field to track when quote was accepted
    
  2. Notes
    - Allows tracking of quote lifecycle timestamps
    - Helpful for reporting and follow-ups
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_quotes' AND column_name = 'sent_at'
  ) THEN
    ALTER TABLE groupage_quotes ADD COLUMN sent_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groupage_quotes' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE groupage_quotes ADD COLUMN accepted_at timestamptz;
  END IF;
END $$;

COMMENT ON COLUMN groupage_quotes.sent_at IS 'Timestamp when quote was emailed to customer';
COMMENT ON COLUMN groupage_quotes.accepted_at IS 'Timestamp when quote was accepted by customer';
