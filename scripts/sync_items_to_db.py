"""
Sync the `items` table in the live Supabase project to match data/items.json.

Use this after hand-editing items.json (e.g. rewriting titles). It upserts
every item by primary key `id`, so it's idempotent and safe to re-run:
existing rows have their columns overwritten to match the JSON, and any new
ids are inserted. Only the `items` table is touched — comments, groups, and
item_similarities are left alone.

Connection prefers the Supabase connection pooler (IPv4-compatible) if
`supabase_db_host` is set in .env, falling back to the direct Postgres
endpoint (db.<ref>.supabase.co:5432) otherwise. The direct endpoint now
requires real IPv6 connectivity on Supabase's newer projects -- if your
network doesn't have it, direct connections fail with a misleading
"server closed the connection unexpectedly" error (DNS falls through to a
non-routable placeholder IP). The pooler works over plain IPv4 and is
the recommended path for scripts/serverless environments anyway.

To use the pooler, get its exact host from:
  Supabase Dashboard -> Project Settings -> Database -> Connection pooling
  (or the "Connect" button at the top of the project) -> "Transaction
  pooler" tab. Copy the Host (e.g. aws-0-us-west-1.pooler.supabase.com)
  into .env as `supabase_db_host`, and the User (e.g.
  postgres.nqyfdluxupdxebziunfr) into .env as `supabase_db_user`.

Run
---
    python scripts/sync_items_to_db.py

Requirements
------------
    pip install psycopg2-binary
"""

import json
import os

import psycopg2
from psycopg2.extras import execute_values

HERE       = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(HERE)
ITEMS_JSON = os.path.join(REPO_ROOT, 'data', 'items.json')
ENV_PATH   = os.path.join(REPO_ROOT, '.env')

PROJECT_REF = 'nqyfdluxupdxebziunfr'   # matches SUPABASE_URL in docs/app.js


def load_env(path):
    env = {}
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
    return env


def main():
    env = load_env(ENV_PATH)
    password = env['supabase_db_password']

    with open(ITEMS_JSON, 'r', encoding='utf-8') as f:
        items = json.load(f)

    rows = [
        (
            it['item_id'],                       # -> items.id (PK)
            it.get('title', ''),
            it.get('author', ''),
            it.get('stance', ''),
            it.get('video_url', ''),
            it.get('thumbnail_url', ''),
            it.get('transcript', ''),
            bool(it.get('is_main_stimulus', False)),
        )
        for it in items
    ]

    pooler_host = env.get('supabase_db_host', '').strip()
    if pooler_host:
        host = pooler_host
        port = int(env.get('supabase_db_port', '6543'))
        user = env.get('supabase_db_user', f'postgres.{PROJECT_REF}')
        print(f'Connecting via pooler: {host}:{port} as {user}')
    else:
        host = f'db.{PROJECT_REF}.supabase.co'
        port = 5432
        user = 'postgres'
        print(f'Connecting via direct endpoint: {host}:{port} '
              f'(requires IPv6 -- set supabase_db_host in .env to use the pooler instead)')

    conn = psycopg2.connect(
        host=host,
        port=port,
        dbname='postgres',
        user=user,
        password=password,
        sslmode='require',
    )
    try:
        with conn, conn.cursor() as cur:
            execute_values(
                cur,
                """
                insert into items
                    (id, title, author, stance, video_url, thumbnail_url, transcript, is_main_stimulus)
                values %s
                on conflict (id) do update set
                    title            = excluded.title,
                    author           = excluded.author,
                    stance           = excluded.stance,
                    video_url        = excluded.video_url,
                    thumbnail_url    = excluded.thumbnail_url,
                    transcript       = excluded.transcript,
                    is_main_stimulus = excluded.is_main_stimulus
                """,
                rows,
            )
            cur.execute('select count(*) from items')
            total = cur.fetchone()[0]
        print(f'Upserted {len(rows)} items. items table now has {total} rows.')
        print('\nNote: bump CONTENT_VERSION in docs/app.js (e.g. "1" -> "2") and '
              'redeploy, or participants with a cached copy in localStorage won\'t '
              'see the update.')
    finally:
        conn.close()


if __name__ == '__main__':
    main()
