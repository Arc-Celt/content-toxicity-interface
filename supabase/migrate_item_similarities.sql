-- Run this in the Supabase SQL editor.
-- Creates item_similarities for content-based (embedding similarity)
-- phase-2 recommendations across the full 160-item pool.
--
-- No FK to items(id) on purpose: this table's data doesn't depend on
-- items/comments being seeded first (they're on a different timeline —
-- items/comments are still being hand-curated), and it's a read-only
-- precomputed lookup table, not something needing referential integrity
-- enforcement. Populate it via Table Editor -> Import data from CSV
-- using content-toxicity-interface/data/item_similarities.csv.

create table item_similarities (
  item_id_a          text not null,
  item_id_b          text not null,
  cosine_similarity  double precision not null,
  primary key (item_id_a, item_id_b)
);

alter table item_similarities enable row level security;

create policy "anon read item_similarities"
  on item_similarities for select to anon using (true);
