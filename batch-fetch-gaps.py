#!/usr/bin/env python3
"""
batch-fetch-gaps.py — AI Wiki refs/videos 누락 일괄 수집

Usage:
  python3 batch-fetch-gaps.py analyze                # 누락 현황 + API 비용 분석
  python3 batch-fetch-gaps.py fetch [OPTIONS]        # API 수집 + 선별 → gaps-results.json

Options:
  --limit N          최대 N개 키워드 처리
  --refs-only        refs만 수집
  --videos-only      videos만 수집
  --delay SEC        API 호출 간 딜레이 (기본: 1.0초)
"""

import json, os, subprocess, sys, time
from urllib.request import Request, urlopen
from urllib.parse import urlencode, urlparse
from pathlib import Path

ROOT = Path(__file__).parent
RESULTS_FILE = ROOT / 'gaps-results.json'

# ── .env ────────────────────────────────────────────────────────────────────
def load_env():
    env = {}
    env_path = ROOT / '.env'
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            k, _, v = line.partition('=')
            env[k.strip()] = v.strip()
    return env

# ── data.js 파싱 ────────────────────────────────────────────────────────────
def get_keywords():
    script = (
        "const fs=require('fs'),c=fs.readFileSync('data.js','utf8');"
        r"const m=c.match(/const D\s*=\s*(\[[\s\S]*?\]);\s*(?:const|var|let|\/\/|$)/);"
        "if(!m){process.exit(1)}"
        "const D=eval(m[1]);"
        "const s=D.map(d=>({id:d.id,t:d.t,en:d.en,c:d.c,"
        "refs:d.refs||[],videos:d.videos||[]}));"
        "process.stdout.write(JSON.stringify(s));"
    )
    r = subprocess.run(['node', '-e', script], capture_output=True, text=True, cwd=str(ROOT))
    if r.returncode != 0:
        print(f"Error parsing data.js: {r.stderr}", file=sys.stderr)
        sys.exit(1)
    return json.loads(r.stdout)

# ── 갭 분석 ─────────────────────────────────────────────────────────────────
def analyze_gaps(keywords):
    gaps = []
    for kw in keywords:
        need_refs = len(kw['refs']) == 0
        en_count = sum(1 for v in kw['videos'] if v.get('lang') == 'en')
        ko_count = sum(1 for v in kw['videos'] if v.get('lang') == 'ko')
        need_en = max(0, 2 - en_count)
        need_ko = max(0, 1 - ko_count)
        if need_refs or need_en or need_ko:
            gaps.append({
                'id': kw['id'], 't': kw['t'], 'en': kw['en'],
                'need_refs': need_refs,
                'need_en': need_en, 'need_ko': need_ko,
            })
    return gaps

# ── Tavily Search ───────────────────────────────────────────────────────────
def tavily_search(query, api_key):
    data = json.dumps({
        'api_key': api_key, 'query': query,
        'max_results': 10, 'include_answer': False,
    }).encode()
    req = Request('https://api.tavily.com/search',
                  data=data, headers={'Content-Type': 'application/json'})
    try:
        with urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
        return [{'title': r.get('title', ''), 'url': r.get('url', ''),
                 'snippet': r.get('content', '')}
                for r in result.get('results', [])]
    except Exception as e:
        print(f"  Tavily error: {e}", file=sys.stderr)
        return []

# ── YouTube Search ──────────────────────────────────────────────────────────
def youtube_search(query, api_key):
    params = urlencode({
        'key': api_key, 'q': query, 'part': 'snippet',
        'type': 'video', 'order': 'relevance', 'maxResults': 10,
    })
    url = f'https://www.googleapis.com/youtube/v3/search?{params}'
    try:
        with urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read())
        return [{'videoId': i['id'].get('videoId', ''),
                 'title': i['snippet'].get('title', ''),
                 'channelTitle': i['snippet'].get('channelTitle', '')}
                for i in data.get('items', [])]
    except Exception as e:
        print(f"  YouTube search error: {e}", file=sys.stderr)
        return []

def youtube_stats(video_ids, api_key):
    if not video_ids:
        return {}
    stats = {}
    for i in range(0, len(video_ids), 50):
        chunk = video_ids[i:i + 50]
        params = urlencode({'key': api_key, 'id': ','.join(chunk), 'part': 'statistics'})
        url = f'https://www.googleapis.com/youtube/v3/videos?{params}'
        try:
            with urlopen(url, timeout=30) as resp:
                data = json.loads(resp.read())
            for item in data.get('items', []):
                stats[item['id']] = int(item.get('statistics', {}).get('viewCount', '0'))
        except Exception as e:
            print(f"  YouTube stats error: {e}", file=sys.stderr)
    return stats

# ── 선별 로직 ───────────────────────────────────────────────────────────────
OFFICIAL_DOMAINS = [
    'anthropic.com', 'openai.com', 'google.com', 'deepmind.com',
    'microsoft.com', 'huggingface.co', 'pytorch.org', 'tensorflow.org',
    'langchain.dev', 'nvidia.com', 'aws.amazon.com',
]

def classify_ref_type(url):
    url_lower = url.lower()
    if any(d in url_lower for d in OFFICIAL_DOMAINS):
        return 'blog' if 'blog' in url_lower else 'official'
    if 'arxiv.org' in url_lower:
        return 'paper'
    if any(k in url_lower for k in ['docs.', 'developer.', 'documentation']):
        return 'official'
    if any(k in url_lower for k in ['blog', 'medium.com', 'substack.com']):
        return 'blog'
    return 'tutorial'

TYPE_PRIORITY = {'official': 0, 'blog': 1, 'paper': 2, 'tutorial': 3}

def select_refs(web_en, web_ko):
    seen_domains = set()
    candidates = []
    for r in web_en + web_ko:
        domain = urlparse(r['url']).netloc
        if domain in seen_domains:
            continue
        seen_domains.add(domain)
        ref_type = classify_ref_type(r['url'])
        candidates.append({
            'title': r['title'], 'url': r['url'], 'type': ref_type,
            '_priority': TYPE_PRIORITY.get(ref_type, 9),
        })
    candidates.sort(key=lambda x: x['_priority'])
    return [{'title': c['title'], 'url': c['url'], 'type': c['type']}
            for c in candidates[:4]]

def select_videos(yt_en, yt_ko, stats, need_en, need_ko):
    def rank(videos):
        return sorted(videos, key=lambda v: stats.get(v['videoId'], 0), reverse=True)

    result = []
    if need_en > 0:
        for v in rank(yt_en)[:need_en]:
            result.append({'title': v['title'], 'id': v['videoId'], 'lang': 'en'})
    if need_ko > 0:
        for v in rank(yt_ko)[:need_ko]:
            result.append({'title': v['title'], 'id': v['videoId'], 'lang': 'ko'})
    return result

# ── CLI: analyze ────────────────────────────────────────────────────────────
def cmd_analyze(keywords):
    gaps = analyze_gaps(keywords)

    refs_only = [g for g in gaps if g['need_refs'] and g['need_en'] == 0 and g['need_ko'] == 0]
    vids_full = [g for g in gaps if g['need_en'] == 2 and g['need_ko'] == 1]
    vids_partial = [g for g in gaps if (g['need_en'] > 0 or g['need_ko'] > 0)
                    and not (g['need_en'] == 2 and g['need_ko'] == 1)]

    tavily_calls = sum(2 for g in gaps if g['need_refs'])
    yt_search_calls = sum((1 if g['need_en'] > 0 else 0) + (1 if g['need_ko'] > 0 else 0)
                          for g in gaps)
    yt_stats_calls = sum(1 for g in gaps if g['need_en'] > 0 or g['need_ko'] > 0)
    yt_units = yt_search_calls * 100 + yt_stats_calls

    print(f"=== 누락 현황 ({len(gaps)}개 키워드) ===")
    print(f"  refs만 누락: {len(refs_only)}개")
    print(f"  videos 완전 누락: {len(vids_full)}개")
    print(f"  videos 부족 (일부): {len(vids_partial)}개")
    print(f"\n=== API 예상 비용 ===")
    print(f"  Tavily: {tavily_calls}회 (한도: 1,000/월)")
    print(f"  YouTube: {yt_units} units (한도: 10,000/일)")
    print(f"    - search.list: {yt_search_calls}회 × 100 = {yt_search_calls * 100}")
    print(f"    - videos.list: {yt_stats_calls}회 × 1 = {yt_stats_calls}")

    if yt_units > 10000:
        units_acc = 0
        day1_count = 0
        for g in gaps:
            cost = ((1 if g['need_en'] > 0 else 0) + (1 if g['need_ko'] > 0 else 0)) * 100 + 1
            if units_acc + cost > 9500:
                break
            units_acc += cost
            day1_count += 1
        print(f"\n  >> 일일 한도 초과! Day 1: --limit {day1_count}, Day 2: 나머지")

    manifest_path = ROOT / 'gaps-manifest.json'
    manifest_path.write_text(json.dumps(gaps, ensure_ascii=False, indent=2))
    print(f"\ngaps-manifest.json 저장 ({len(gaps)}개)")

# ── CLI: fetch ──────────────────────────────────────────────────────────────
def cmd_fetch(keywords, cli_args):
    env = load_env()
    tavily_key = env.get('TAVILY_API_KEY', '')
    youtube_key = env.get('YOUTUBE_API_KEY', '')

    gaps = analyze_gaps(keywords)

    refs_only = '--refs-only' in cli_args
    videos_only = '--videos-only' in cli_args
    limit = None
    delay = 1.0
    for i, a in enumerate(cli_args):
        if a == '--limit' and i + 1 < len(cli_args):
            limit = int(cli_args[i + 1])
        if a == '--delay' and i + 1 < len(cli_args):
            delay = float(cli_args[i + 1])

    if limit:
        gaps = gaps[:limit]

    # 기존 결과 로드 (이어하기)
    existing = {}
    if RESULTS_FILE.exists():
        for r in json.loads(RESULTS_FILE.read_text()):
            existing[r['id']] = r

    results = list(existing.values())
    done_ids = set(existing.keys())

    total = len(gaps)
    for idx, gap in enumerate(gaps):
        if gap['id'] in done_ids:
            print(f"[{idx+1}/{total}] {gap['id']} — skip (이미 수집)")
            continue

        print(f"[{idx+1}/{total}] {gap['id']} ({gap['t']})")
        entry = {'id': gap['id'], 'refs': [], 'videos': []}

        en_query = gap['en'] or gap['t']
        ko_query = gap['t']

        # ── refs ──
        if gap['need_refs'] and not videos_only:
            if not tavily_key:
                print("  TAVILY_API_KEY 없음, 건너뜀")
            else:
                web_en = tavily_search(en_query, tavily_key)
                time.sleep(delay)
                web_ko = tavily_search(ko_query, tavily_key)
                time.sleep(delay)
                entry['refs'] = select_refs(web_en, web_ko)
                print(f"  refs: {len(entry['refs'])}개 선별")

        # ── videos ──
        needs_video = (gap['need_en'] > 0 or gap['need_ko'] > 0)
        if needs_video and not refs_only:
            if not youtube_key:
                print("  YOUTUBE_API_KEY 없음, 건너뜀")
            else:
                yt_en, yt_ko = [], []
                if gap['need_en'] > 0:
                    yt_en = youtube_search(f"AI {en_query} explained", youtube_key)
                    time.sleep(delay)
                if gap['need_ko'] > 0:
                    yt_ko = youtube_search(f"AI {ko_query} 설명", youtube_key)
                    time.sleep(delay)

                all_ids = list({v['videoId'] for v in yt_en + yt_ko if v['videoId']})
                stats = youtube_stats(all_ids, youtube_key) if all_ids else {}
                if all_ids:
                    time.sleep(delay)

                entry['videos'] = select_videos(yt_en, yt_ko, stats,
                                                gap['need_en'], gap['need_ko'])
                print(f"  videos: {len(entry['videos'])}개 선별")

        if entry['refs'] or entry['videos']:
            results.append(entry)
            done_ids.add(gap['id'])

        # 매 키워드마다 중간 저장
        RESULTS_FILE.write_text(json.dumps(results, ensure_ascii=False, indent=2))

    print(f"\n완료: {len(results)}개 키워드 → {RESULTS_FILE.name}")

# ── main ────────────────────────────────────────────────────────────────────
def main():
    args = sys.argv[1:]
    if not args or args[0] in ('-h', '--help'):
        print(__doc__)
        return

    mode = args[0]
    keywords = get_keywords()
    print(f"data.js: {len(keywords)}개 키워드")

    if mode == 'analyze':
        cmd_analyze(keywords)
    elif mode == 'fetch':
        cmd_fetch(keywords, args[1:])
    else:
        print(f"Unknown mode: {mode}")
        sys.exit(1)

if __name__ == '__main__':
    main()
