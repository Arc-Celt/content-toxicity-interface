"""
Generate seed.sql from video_metadata.csv.
Paste the output into the Supabase SQL editor to seed items + comments.

Run: python scripts/generate_seed.py
"""

import random
import pandas as pd
from faker import Faker

CSV_PATH    = r'e:\RA\Sauder\video_pilot_study\data\immigration\video_metadata.csv'
OUTPUT_SQL  = r'e:\RA\Sauder\social_feed_study\supabase\seed.sql'

# Pre-generate a pool of 200 realistic TikTok-style usernames.
# Fixed seed → same names every run.
_fake = Faker()
Faker.seed(42)
random.seed(42)

def _tiktok_name(fake):
    """e.g. sunny_vibe91, alex_k, cool_breeze, jada.m2"""
    styles = [
        lambda: fake.user_name(),                                          # john_doe
        lambda: f"{fake.first_name().lower()}_{fake.last_name().lower()[:3]}{random.randint(10,99)}",
        lambda: f"{fake.word()}{fake.word()}{random.randint(1,999)}",     # sunnyvibes42
        lambda: f"{fake.first_name().lower()}.{fake.last_name().lower()[:1]}{random.randint(0,9)}",
    ]
    return random.choice(styles)()

USERNAME_POOL = [_tiktok_name(_fake) for _ in range(200)]


def pick_username(item_id: str, display_order: int) -> str:
    """Deterministic per (item, position) — consistent across re-runs."""
    idx = hash(f'{item_id}:{display_order}') % len(USERNAME_POOL)
    return '@' + USERNAME_POOL[abs(idx)]


def esc(val):
    """Escape a string for SQL single-quote literals."""
    return str(val or '').replace("'", "''")


def main():
    df = pd.read_csv(CSV_PATH, encoding='utf-8-sig')

    lines = [
        '-- Auto-generated seed — run in Supabase SQL editor',
        '-- ============================================================',
        '',
        '-- Items',
        'insert into items (id, title, author, stance, video_url, transcript) values',
    ]

    item_values = []
    all_comment_rows = []

    for _, row in df.iterrows():
        item_id    = str(row['author_name']).strip()
        title      = esc(row.get('title', ''))
        author     = esc(item_id)
        stance     = esc(row['stance'])
        video_url  = esc(row.get('qualtrics_url', ''))
        transcript = esc(row.get('transcript', ''))

        item_values.append(
            f"  ('{item_id}', '{title}', '{author}', '{stance}', '{video_url}', '{transcript}')"
        )

        # comments
        raw = str(row.get('top_20_comments', '') or '')
        if raw and raw.lower() != 'nan':
            texts = [t.strip() for t in raw.split('|||') if t.strip()]
            for i, text in enumerate(texts, start=1):
                all_comment_rows.append({
                    'id':            f'{item_id}_c{i:02d}',
                    'item_id':       item_id,
                    'author':        pick_username(item_id, i),
                    'body':          text,
                    'upvotes':       0,
                    'display_order': i,
                })

    lines.append(',\n'.join(item_values) + ';')
    lines.append('')

    # comments in batches of 50 for readability
    lines.append('-- Comments')
    batch_size = 50
    for start in range(0, len(all_comment_rows), batch_size):
        batch = all_comment_rows[start:start + batch_size]
        lines.append('insert into comments (id, item_id, author, body, upvotes, display_order) values')
        vals = []
        for c in batch:
            vals.append(
                f"  ('{esc(c['id'])}', '{esc(c['item_id'])}', '{esc(c['author'])}', "
                f"'{esc(c['body'])}', {c['upvotes']}, {c['display_order']})"
            )
        lines.append(',\n'.join(vals) + ';')
        lines.append('')

    sql = '\n'.join(lines)

    with open(OUTPUT_SQL, 'w', encoding='utf-8') as f:
        f.write(sql)

    total_comments = len(all_comment_rows)
    print(f'Written to {OUTPUT_SQL}')
    print(f'  {len(df)} items')
    print(f'  {total_comments} comments')
    print(f'\nPaste seed.sql into Supabase SQL editor → Run.')


if __name__ == '__main__':
    main()