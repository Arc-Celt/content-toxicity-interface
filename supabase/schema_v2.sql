-- =============================================================
-- content-toxicity-interface — Supabase schema (content-only, v2)
--
-- Behavior tracking no longer touches Supabase: phase1.html/phase2.html
-- build a payload client-side and postMessage it to the parent Qualtrics
-- page, which stores it as embedded data (see the addOnload listeners
-- for "phase1_update"/"phase1_complete"/"phase2_update"/"phase2_complete").
-- Confirmed by grepping the app code — it only ever calls
-- .from("groups"), .from("items"), .from("comments"). No participants,
-- sessions, or interaction-log tables are read or written anywhere.
--
-- This DB is purely a read-only content host for the experiment
-- materials: items, comments, the stance/format group lookup, and
-- item_similarities for phase-2 content-based recommendations.
-- =============================================================

create table items (
  id                text primary key,   -- {author}_{video_id}
  title             text,
  author            text,
  stance            text,               -- 'pro_immigration' | 'anti_immigration'
  video_url         text,
  transcript        text,               -- JSON-encoded array of paragraph strings
  is_main_stimulus  boolean not null default false
);

create table comments (
  id            text    not null,
  item_id       text    not null references items(id) on delete cascade,
  author        text    not null,
  body          text    not null,
  upvotes       integer not null default 0,
  display_order integer not null,
  primary key (id, item_id)
);

-- maps group code -> stance + format (resolved once per session via GROUP)
create table groups (
  group_code  text primary key,
  stance      text not null check (stance in ('pro_immigration', 'anti_immigration')),
  format      text not null check (format in ('video', 'transcript'))
);

-- phase-2 content-based recommendations, full 160x160 symmetric matrix
-- (no FK to items(id) — populated independently via CSV import, and is a
-- precomputed lookup table rather than something needing referential
-- integrity enforcement)
create table item_similarities (
  item_id_a          text not null,
  item_id_b          text not null,
  cosine_similarity  double precision not null,
  primary key (item_id_a, item_id_b)
);

alter table items             enable row level security;
alter table comments          enable row level security;
alter table groups            enable row level security;
alter table item_similarities enable row level security;

create policy "anon read items"             on items             for select to anon using (true);
create policy "anon read comments"          on comments          for select to anon using (true);
create policy "anon read groups"            on groups            for select to anon using (true);
create policy "anon read item_similarities" on item_similarities for select to anon using (true);
