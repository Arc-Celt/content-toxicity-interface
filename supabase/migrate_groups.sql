-- Run this in the Supabase SQL editor.
-- Drops and recreates the groups table with stance+format instead of item_id+condition,
-- then seeds the 4 conditions. Safe to run because groups is empty at this point.

-- Drop and recreate (CASCADE removes the FK constraint on participants, we re-add it below)
DROP TABLE IF EXISTS groups CASCADE;

CREATE TABLE groups (
  group_code  text primary key,
  stance      text not null check (stance in ('pro_immigration', 'anti_immigration')),
  format      text not null check (format in ('video', 'transcript'))
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon read groups" ON groups FOR SELECT TO anon USING (true);

-- Seed FIRST so existing participant rows pass FK validation below
-- A = pro_immigration, B = anti_immigration
-- 1 = video, 2 = transcript
INSERT INTO groups (group_code, stance, format) VALUES
  ('A1', 'pro_immigration',  'video'),
  ('A2', 'pro_immigration',  'transcript'),
  ('B1', 'anti_immigration', 'video'),
  ('B2', 'anti_immigration', 'transcript');

-- Re-add the FK on participants that CASCADE dropped
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_group_code_fkey;
ALTER TABLE participants ADD CONSTRAINT participants_group_code_fkey
  FOREIGN KEY (group_code) REFERENCES groups(group_code);