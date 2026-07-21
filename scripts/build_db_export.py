"""
Consolidate the 160-video pool into two hand-editable JSON files for the
content-toxicity-interface Supabase migration.

Reads:
  E:\\RA\\Sauder\\video_pilot_study\\data\\immigration\\hashtag_scrape\\us_filtered.csv
  G:\\Research\\80 selected\\transcripts\\{anti,pro}\\*.txt
  E:\\RA\\Sauder\\video_pilot_study\\data\\immigration\\stimuli_selection\\selected_40.csv
  E:\\RA\\Sauder\\video_pilot_study\\data\\immigration\\hashtag_scrape\\comments.jsonl

Writes:
  data/items.json     — one object per pool video (160)
  data/comments.json  — one object per comment (all comments currently fetched)

`video_url` is left blank for the user to fill in by hand once videos are
hosted. Comments are NOT capped/curated here — that's a manual quality
pass the user does later. `is_main_stimulus` just marks membership in the
40 selected stimuli; the selection metadata itself (duration_s,
toxic_sentence_count, paired_with, pair_distance) is intentionally not
duplicated here — it stays in selected_40.csv.

Run
---
    python scripts/build_db_export.py

Requirements
------------
    pip install pandas faker
"""

import json
import os
import random

import pandas as pd
from faker import Faker

# ── Paths ─────────────────────────────────────────────────────────────────────
VIDEO_PILOT_STUDY = r'E:\RA\Sauder\video_pilot_study'
TRANSCRIPT_ROOTS = {
    'anti': r'G:\Research\80 selected\transcripts\anti',
    'pro':  r'G:\Research\80 selected\transcripts\pro',
}
US_FILTERED_CSV = os.path.join(VIDEO_PILOT_STUDY, r'data\immigration\hashtag_scrape\us_filtered.csv')
SELECTED_40_CSV = os.path.join(VIDEO_PILOT_STUDY, r'data\immigration\stimuli_selection\selected_40.csv')
COMMENTS_JSONL  = os.path.join(VIDEO_PILOT_STUDY, r'data\immigration\hashtag_scrape\comments.jsonl')

OUT_DIR       = r'E:\RA\Sauder\content-toxicity-interface\data'
ITEMS_JSON    = os.path.join(OUT_DIR, 'items.json')
COMMENTS_JSON = os.path.join(OUT_DIR, 'comments.json')

STANCE_MAP = {'anti': 'anti_immigration', 'pro': 'pro_immigration'}

# Faker username pool — same deterministic setup as
# content-toxicity-interface/scripts/generate_seed.py (real comment authors
# were never captured by fetch_comments.py, so this reuses that established
# workaround rather than inventing a new one).
_fake = Faker()
Faker.seed(42)
random.seed(42)


def _tiktok_name(fake):
    styles = [
        lambda: fake.user_name(),
        lambda: f"{fake.first_name().lower()}_{fake.last_name().lower()[:3]}{random.randint(10, 99)}",
        lambda: f"{fake.word()}{fake.word()}{random.randint(1, 999)}",
        lambda: f"{fake.first_name().lower()}.{fake.last_name().lower()[:1]}{random.randint(0, 9)}",
    ]
    return random.choice(styles)()


USERNAME_POOL = [_tiktok_name(_fake) for _ in range(200)]


def pick_username(item_id: str, display_order: int) -> str:
    idx = hash(f'{item_id}:{display_order}') % len(USERNAME_POOL)
    return '@' + USERNAME_POOL[abs(idx)]


def _read_transcript(group: str, stem: str) -> str:
    """Returns a JSON-encoded array of segments, not a flattened paragraph —
    the app does JSON.parse(item.transcript) and renders each element as
    its own <p> (see docs/app.js, popup.html, feed.html)."""
    path = os.path.join(TRANSCRIPT_ROOTS[group], stem + '.txt')
    with open(path, 'r', encoding='utf-8') as f:
        lines = [l.strip() for l in f if l.strip()]
    return json.dumps(lines, ensure_ascii=False)


def build_items():
    meta = pd.read_csv(US_FILTERED_CSV, dtype=str)
    meta = meta.drop_duplicates(subset='video_id').set_index('video_id')

    # only need to know WHICH items are main stimuli — the matching metadata
    # (duration_s, toxic_sentence_count, paired_with, pair_distance) was
    # only ever an input to the offline selection algorithm, not something
    # the running app needs; it stays permanently recorded in
    # data/immigration/stimuli_selection/selected_40.csv instead.
    main_stimulus_ids = set(pd.read_csv(SELECTED_40_CSV)['item_id'])

    items = []
    for group, folder in TRANSCRIPT_ROOTS.items():
        for fname in sorted(os.listdir(folder)):
            if not fname.endswith('.txt'):
                continue
            stem = fname[:-4]
            video_id = stem.rsplit('_', 1)[-1]
            author = stem[:-(len(video_id) + 1)]

            title = ''
            if video_id in meta.index:
                desc = meta.loc[video_id, 'video_description']
                if isinstance(desc, str) and desc.strip().lower() != 'nan':
                    title = desc

            items.append({
                'item_id': stem,
                'author': author,
                'stance': STANCE_MAP[group],
                'title': title,
                'transcript': _read_transcript(group, stem),
                'video_url': '',
                'is_main_stimulus': stem in main_stimulus_ids,
            })

    return items


def build_comments(valid_item_ids: set):
    rows = []
    with open(COMMENTS_JSONL, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rec = json.loads(line)
            item_id = rec['filename'][:-4]  # strip .txt
            if item_id not in valid_item_ids:
                continue

            comments = sorted(rec.get('comments', []), key=lambda c: c.get('digg_count', 0), reverse=True)
            for i, c in enumerate(comments, start=1):
                rows.append({
                    'item_id': item_id,
                    'author': pick_username(item_id, i),
                    'body': c.get('text', ''),
                    'upvotes': c.get('digg_count', 0),
                    'display_order': i,
                })
    return rows


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    items = build_items()
    with open(ITEMS_JSON, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    n_main = sum(1 for i in items if i['is_main_stimulus'])
    print(f'items.json: {len(items)} items ({n_main} main stimuli)')
    print(f'Saved -> {ITEMS_JSON}')

    item_ids = {i['item_id'] for i in items}
    comments = build_comments(item_ids)
    with open(COMMENTS_JSON, 'w', encoding='utf-8') as f:
        json.dump(comments, f, ensure_ascii=False, indent=2)

    covered = len({c['item_id'] for c in comments})
    print(f'\ncomments.json: {len(comments)} comments across {covered} items')
    print(f'Saved -> {COMMENTS_JSON}')


if __name__ == '__main__':
    main()
