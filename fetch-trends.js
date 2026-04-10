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

  const hnTavilyQuery = 'AI OR LLM OR machine learning new 2026 site:news.ycombinator.com';
  const redditQuery = 'AI OR LLM OR machine learning new 2026 site:reddit.com';

  const [hackernews, hackernews_tavily, reddit] = await Promise.all([
    fetchHackerNews(),
    tavilySearch(hnTavilyQuery, TAVILY_API_KEY, 10),
    tavilySearch(redditQuery, TAVILY_API_KEY, 10),
  ]);

  const result = {
    hackernews,
    hackernews_tavily,
    reddit,
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
