-- =============================================================
-- social_feed_study — Supabase schema
-- Run this in the Supabase SQL editor to set up the database.
-- =============================================================


-- =============================================================
-- CONTENT TABLES  (read-only for participants)
-- =============================================================

create table items (
  id          text primary key,   -- e.g. 'v1', 'v2'
  title       text,
  author      text,
  stance      text,               -- used to filter same-stance recommendations
  video_url   text,
  transcript  text
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

-- maps group code (e.g. 'A1') → main item + media condition
create table groups (
  group_code  text primary key,
  item_id     text not null references items(id),
  condition   text not null check (condition in ('video', 'transcript'))
);


-- =============================================================
-- PARTICIPANTS
-- =============================================================

create table participants (
  pid                     text primary key,
  group_code              text not null references groups(group_code),
  main_item_id            text not null references items(id),
  condition               text not null check (condition in ('video', 'transcript')),
  phase1_completed_at     timestamptz,
  phase2_completed_at     timestamptz,
  created_at              timestamptz not null default now()
);


-- =============================================================
-- SESSIONS
-- Written once on Continue click (bulk write strategy).
-- navigation_history is built in JS and sent on completion.
-- =============================================================

create table sessions (
  id                 bigserial primary key,
  pid                text not null references participants(pid),
  session_type       text not null check (session_type in ('phase1', 'phase2')),
  navigation_history text[],          -- ordered item IDs visited; phase1 = ['v1']
  started_at         timestamptz not null,
  completed_at       timestamptz,
  unique (pid, session_type)
);

-- One row per item viewed, inserted when the participant leaves that item
-- (or on Continue for the final item). Both timestamps known at insert time.
create table item_views (
  id            bigserial primary key,
  session_id    bigint  not null references sessions(id),
  pid           text    not null,
  session_type  text    not null,
  item_id       text    not null references items(id),
  view_order    integer not null,     -- 1 = first item this session
  viewed_at     timestamptz not null,
  left_at       timestamptz not null
);


-- =============================================================
-- POST-LEVEL BEHAVIOR
--
-- post_likes / post_reposts are event-log style:
--   each toggle creates a new row (liked=true then liked=false = 2 rows).
--   For final state, take the row with MAX(recorded_at) per
--   (pid, session_type, item_id).
-- =============================================================

create table post_likes (
  id            bigserial primary key,
  pid           text    not null,
  session_type  text    not null,
  item_id       text    not null references items(id),
  liked         boolean not null,
  recorded_at   timestamptz not null default now()
);

create table post_reposts (
  id            bigserial primary key,
  pid           text    not null,
  session_type  text    not null,
  item_id       text    not null references items(id),
  reposted      boolean not null,
  recorded_at   timestamptz not null default now()
);

-- Reports are one-way (no untoggle), so just one row per report.
create table post_reports (
  id            bigserial primary key,
  pid           text not null,
  session_type  text not null,
  item_id       text not null references items(id),
  reason        text not null,
  recorded_at   timestamptz not null default now()
);

create table post_replies (
  id            bigserial primary key,
  pid           text    not null,
  session_type  text    not null,
  item_id       text    not null references items(id),
  body          text    not null,
  reply_index   integer not null,     -- 1 = first reply this session on this item
  recorded_at   timestamptz not null default now()
);


-- =============================================================
-- COMMENT SECTION EXPANSION
-- One row per "load more" click. If zero rows for a (pid, item),
-- participant never expanded past the initial view.
-- =============================================================

create table comment_expansions (
  id               bigserial primary key,
  pid              text    not null,
  session_type     text    not null,
  item_id          text    not null references items(id),
  expansion_index  integer not null,   -- 1 = first click, 2 = second, etc.
  comments_visible integer not null,   -- total comments visible after this click
  expanded_at      timestamptz not null default now()
);


-- =============================================================
-- COMMENT-LEVEL BEHAVIOR
-- Same event-log convention as post_likes / post_reposts.
-- =============================================================

create table comment_likes (
  id            bigserial primary key,
  pid           text    not null,
  session_type  text    not null,
  item_id       text    not null,
  comment_id    text    not null,
  liked         boolean not null,
  recorded_at   timestamptz not null default now()
);

create table comment_reposts (
  id            bigserial primary key,
  pid           text    not null,
  session_type  text    not null,
  item_id       text    not null,
  comment_id    text    not null,
  reposted      boolean not null,
  recorded_at   timestamptz not null default now()
);

create table comment_reports (
  id            bigserial primary key,
  pid           text not null,
  session_type  text not null,
  item_id       text not null,
  comment_id    text not null,
  reason        text not null,
  recorded_at   timestamptz not null default now()
);

create table comment_replies (
  id            bigserial primary key,
  pid           text    not null,
  session_type  text    not null,
  item_id       text    not null,
  comment_id    text    not null,
  body          text    not null,
  reply_index   integer not null,
  recorded_at   timestamptz not null default now()
);


-- =============================================================
-- SIDEBAR CLICKS
-- phase1: click → unavailable modal (still logged)
-- phase2: click → navigation to that item (also creates item_view)
-- =============================================================

create table sidebar_clicks (
  id               bigserial primary key,
  pid              text    not null,
  session_type     text    not null,
  source_item_id   text    not null references items(id),
  clicked_item_id  text    not null references items(id),
  click_order      integer not null,   -- nth sidebar click this session
  clicked_at       timestamptz not null default now()
);


-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================

alter table items             enable row level security;
alter table comments          enable row level security;
alter table groups            enable row level security;
alter table participants      enable row level security;
alter table sessions          enable row level security;
alter table item_views        enable row level security;
alter table post_likes        enable row level security;
alter table post_reposts      enable row level security;
alter table post_reports      enable row level security;
alter table post_replies      enable row level security;
alter table comment_expansions enable row level security;
alter table comment_likes     enable row level security;
alter table comment_reposts   enable row level security;
alter table comment_reports   enable row level security;
alter table comment_replies   enable row level security;
alter table sidebar_clicks    enable row level security;

-- Content: open read, no writes from client
create policy "anon read items"    on items    for select to anon using (true);
create policy "anon read comments" on comments for select to anon using (true);
create policy "anon read groups"   on groups   for select to anon using (true);

-- Participants: insert only (no read — prevents scraping PIDs)
create policy "anon insert participants"
  on participants for insert to anon with check (true);

-- Sessions + all behavior tables: insert only
create policy "anon insert sessions"
  on sessions for insert to anon with check (true);

create policy "anon insert item_views"
  on item_views for insert to anon with check (true);

create policy "anon insert post_likes"
  on post_likes for insert to anon with check (true);

create policy "anon insert post_reposts"
  on post_reposts for insert to anon with check (true);

create policy "anon insert post_reports"
  on post_reports for insert to anon with check (true);

create policy "anon insert post_replies"
  on post_replies for insert to anon with check (true);

create policy "anon insert comment_expansions"
  on comment_expansions for insert to anon with check (true);

create policy "anon insert comment_likes"
  on comment_likes for insert to anon with check (true);

create policy "anon insert comment_reposts"
  on comment_reposts for insert to anon with check (true);

create policy "anon insert comment_reports"
  on comment_reports for insert to anon with check (true);

create policy "anon insert comment_replies"
  on comment_replies for insert to anon with check (true);

create policy "anon insert sidebar_clicks"
  on sidebar_clicks for insert to anon with check (true);


-- =============================================================
-- REPLY-LEVEL INTERACTIONS
-- Tracks Like, Repost, Edit, Delete on the participant's own
-- replies (both post-level and comment-level replies).
-- action_type: 'like' | 'unlike' | 'repost' | 'unrepost' | 'edit' | 'delete'
-- value: updated text for 'edit'; null for all other actions.
-- =============================================================

create table post_reply_interactions (
  id            bigserial primary key,
  pid           text    not null,
  session_type  text    not null,
  item_id       text    not null,
  reply_index   integer not null,
  action_type   text    not null check (action_type in ('like','unlike','repost','unrepost','edit','delete')),
  value         text,
  recorded_at   timestamptz not null default now()
);

create table comment_reply_interactions (
  id            bigserial primary key,
  pid           text    not null,
  session_type  text    not null,
  item_id       text    not null,
  comment_id    text    not null,
  reply_index   integer not null,
  action_type   text    not null check (action_type in ('like','unlike','repost','unrepost','edit','delete')),
  value         text,
  recorded_at   timestamptz not null default now()
);

alter table post_reply_interactions    enable row level security;
alter table comment_reply_interactions enable row level security;

create policy "anon insert post_reply_interactions"
  on post_reply_interactions for insert to anon with check (true);
create policy "anon insert comment_reply_interactions"
  on comment_reply_interactions for insert to anon with check (true);
