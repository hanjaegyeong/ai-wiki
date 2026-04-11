#!/usr/bin/env node
/**
 * fetch-trends.js
 * Usage: node fetch-trends.js
 *
 * Collects recent AI-related trending topics from 3 sources in parallel,
 * then outputs JSON to stdout.
 * Reads API keys from .env (no external packages).
 */

const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const { resolve } = require('path');

// ---------------------------------------------------------------------------
// .env parser
// ---------------------------------------------------------------------------
function loadEnv(envPath) {
  let raw;
  try {
    raw = readFileSync(envPath, 'utf8');
  } catch {
    return {};
  }
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

// ---------------------------------------------------------------------------
// GeekNews (news.hada.io) — HTML scraping
// ---------------------------------------------------------------------------
const GN_BASE = 'https://news.hada.io';
const GN_HEADERS = { 'User-Agent': 'AI-Wiki-Bot/1.0' };

async function fetchGeekNews() {
  const res = await fetch(GN_BASE + '/new', { headers: GN_HEADERS });
  if (!res.ok) throw new Error(`GeekNews error (${res.status})`);
  const html = await res.text();

  const articles = [];
  // Split by topic_row boundaries
  const parts = html.split(/class='topic_row'/);
  for (let i = 1; i < parts.length && articles.length < 10; i++) {
    const block = parts[i];

    // Title + URL: <a href='topic?id=NNN' ...><h1>Title</h1></a>
    const linkMatch = block.match(/class=topictitle>[\s\S]*?<a[^>]+href='([^']+)'[^>]*>([\s\S]*?)<\/a>/);
    if (!linkMatch) continue;

    let url = linkMatch[1];
    const title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
    if (!url.startsWith('http')) url = GN_BASE + '/' + url;

    // Points: <span id='tpNNN'>NN</span>
    const ptsMatch = block.match(/<span id='tp\d+'>(\d+)<\/span>/);
    const points = ptsMatch ? parseInt(ptsMatch[1]) : 0;

    articles.push({ title, url, points });
  }
  return articles;
}

async function fetchGeekNewsWeekly() {
  // 1. Find latest weekly ID
  const listRes = await fetch(GN_BASE + '/weekly', { headers: GN_HEADERS });
  if (!listRes.ok) throw new Error(`GeekNews weekly list error (${listRes.status})`);
  const listHtml = await listRes.text();

  const idMatch = listHtml.match(/<a href='\/weekly\/(\d+)' class='u'>/);
  if (!idMatch) throw new Error('GeekNews: 최신 주간뉴스 ID를 찾을 수 없음');
  const weeklyId = idMatch[1];

  // 2. Fetch weekly detail
  const detailRes = await fetch(`${GN_BASE}/weekly/${weeklyId}`, { headers: GN_HEADERS });
  if (!detailRes.ok) throw new Error(`GeekNews weekly detail error (${detailRes.status})`);
  const detailHtml = await detailRes.text();

  // 3. Extract items from desc div
  const items = [];
  const descMatch = detailHtml.match(/class=['"]desc['"]>([\s\S]*?)<\/div>/);
  if (descMatch) {
    const linkRegex = /<a[^>]+href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/g;
    let m;
    while ((m = linkRegex.exec(descMatch[1])) !== null) {
      let linkUrl = m[1];
      const linkTitle = m[2].trim();
      if (!linkTitle || !linkUrl) continue;
      if (!linkUrl.startsWith('http')) linkUrl = GN_BASE + linkUrl;
      if (!items.some(it => it.url === linkUrl)) {
        items.push({ title: linkTitle, url: linkUrl });
      }
    }
  }

  return { id: weeklyId, items };
}

// ---------------------------------------------------------------------------
// Hacker News
// ---------------------------------------------------------------------------
const HN_AI_KEYWORDS = [
  'AI', 'ML', 'LLM', 'GPT', 'Claude', 'OpenAI', 'Anthropic', 'transformer',
  'neural', 'agent', 'RAG', 'embedding', 'fine-tun', 'diffusion', 'multimodal',
  'reasoning', 'context window', 'token', 'prompt', 'model',
  'machine learning', 'deep learning', 'NLP', 'vision', 'generative',
];

function isAiRelated(title) {
  const lower = title.toLowerCase();
  return HN_AI_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

async function fetchHackerNews() {
  const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
  if (!topRes.ok) {
    throw new Error(`HN topstories error (${topRes.status})`);
  }
  const ids = await topRes.json();
  const top30 = ids.slice(0, 30);

  const items = await Promise.all(
    top30.map(async id => {
      const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      if (!res.ok) return null;
      return res.json();
    })
  );

  return items
    .filter(item => item && item.title && isAiRelated(item.title))
    .map(item => ({
      title: item.title || '',
      url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
      score: item.score || 0,
    }));
}

// ---------------------------------------------------------------------------
// Tavily Search
// ---------------------------------------------------------------------------
async function tavilySearch(query, apiKey, maxResults = 10) {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query: query,
      max_results: maxResults,
      include_answer: false,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Tavily error (${res.status}): ${body}`);
  }
  const data = await res.json();
  return (data.results || []).map(item => ({
    title: item.title || '',
    link: item.url || '',
    snippet: item.content || '',
  }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function parseSaveDir(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--save-dir' && argv[i + 1]) return argv[i + 1];
  }
  return null;
}

async function main() {
  const env = loadEnv(resolve(__dirname, '.env'));
  const saveDir = parseSaveDir(process.argv.slice(2));

  const TAVILY_API_KEY = env.TAVILY_API_KEY || process.env.TAVILY_API_KEY;

  if (!TAVILY_API_KEY) {
    console.error('Missing TAVILY_API_KEY in .env');
    process.exit(1);
  }

  const redditQuery = 'AI OR LLM OR machine learning new 2026 site:reddit.com';

  const [hackernews, reddit, geeknews, geeknews_weekly] = await Promise.all([
    fetchHackerNews(),
    tavilySearch(redditQuery, TAVILY_API_KEY, 10),
    fetchGeekNews().catch(err => { console.error('GeekNews fetch failed:', err.message); return []; }),
    fetchGeekNewsWeekly().catch(err => { console.error('GeekNews weekly failed:', err.message); return { id: '', items: [] }; }),
  ]);

  const result = {
    hackernews,
    reddit,
    geeknews,
    geeknews_weekly,
  };

  const json = JSON.stringify(result, null, 2);
  console.log(json);

  if (saveDir) {
    mkdirSync(saveDir, { recursive: true });
    writeFileSync(resolve(saveDir, 'trends.json'), json);
    console.error(`Saved to ${saveDir}/trends.json`);
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
