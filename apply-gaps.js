#!/usr/bin/env node
'use strict';

/**
 * apply-gaps.js — gaps-results.json의 refs/videos를 data.js 기존 항목에 머지
 *
 * Usage: node apply-gaps.js [gaps-results.json]
 *
 * - 기존 refs/videos 보존, 누락분만 추가
 * - URL/ID 중복 자동 제거
 * - updated 날짜 갱신
 */

const fs = require('fs');
const path = require('path');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escapeSingle(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatRefs(refs) {
  if (!refs || refs.length === 0) return '[]';
  return '[' + refs.map(r =>
    `{title:'${escapeSingle(r.title)}',url:'${escapeSingle(r.url)}',type:'${escapeSingle(r.type)}'}`
  ).join(',') + ']';
}

function formatVideos(videos) {
  if (!videos || videos.length === 0) return '[]';
  return '[' + videos.map(v =>
    `{title:'${escapeSingle(v.title)}',id:'${escapeSingle(v.id)}',lang:'${escapeSingle(v.lang)}'}`
  ).join(',') + ']';
}

/**
 * Find matching ] for the [ at openPos.
 * Skips brackets inside single-quoted strings.
 */
function findMatchingBracket(src, openPos) {
  let depth = 0;
  let inStr = false;
  for (let i = openPos; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === "'") inStr = false;
      continue;
    }
    if (ch === "'") { inStr = true; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Locate a field (refs or videos) within a specific entry in data.js source.
 * Returns {start, bracketOpen, bracketClose} or null.
 */
function findEntryField(src, entryId, fieldName) {
  const idNeedle = `id:'${entryId}'`;
  const idPos = src.indexOf(idNeedle);
  if (idPos === -1) return null;

  // Entry boundary: next id:' or end of D array
  const nextId = src.indexOf("id:'", idPos + idNeedle.length);
  const entryEnd = nextId === -1 ? src.length : nextId;

  const fieldNeedle = `${fieldName}:[`;
  const fieldPos = src.indexOf(fieldNeedle, idPos);
  if (fieldPos === -1 || fieldPos > entryEnd) return null;

  const bracketOpen = fieldPos + fieldName.length + 1;
  const bracketClose = findMatchingBracket(src, bracketOpen);
  if (bracketClose === -1) return null;

  return { start: fieldPos, bracketOpen, bracketClose };
}

function main() {
  const jsonPath = path.resolve(process.argv[2] || 'gaps-results.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`${jsonPath} not found. Run: python3 batch-fetch-gaps.py fetch`);
    process.exit(1);
  }

  const results = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const dataPath = path.resolve(__dirname, 'data.js');

  // Backup
  fs.copyFileSync(dataPath, dataPath + '.bak');

  let src = fs.readFileSync(dataPath, 'utf8');
  const dateStr = today();
  let updated = 0;
  let refsAdded = 0;
  let videosAdded = 0;

  for (const entry of results) {
    const { id } = entry;
    let changed = false;

    // ── Merge refs ──
    if (entry.refs && entry.refs.length > 0) {
      const field = findEntryField(src, id, 'refs');
      if (field) {
        const rawStr = src.slice(field.bracketOpen, field.bracketClose + 1);
        let existing = [];
        try { existing = eval(rawStr); } catch {}

        const existingUrls = new Set(existing.map(r => r.url));
        const fresh = entry.refs.filter(r => !existingUrls.has(r.url));
        if (fresh.length > 0) {
          const merged = [...existing, ...fresh];
          const replacement = `refs:${formatRefs(merged)}`;
          src = src.slice(0, field.start) + replacement + src.slice(field.bracketClose + 1);
          refsAdded += fresh.length;
          changed = true;
        }
      }
    }

    // ── Merge videos ──
    if (entry.videos && entry.videos.length > 0) {
      const field = findEntryField(src, id, 'videos');
      if (field) {
        const rawStr = src.slice(field.bracketOpen, field.bracketClose + 1);
        let existing = [];
        try { existing = eval(rawStr); } catch {}

        const existingIds = new Set(existing.map(v => v.id));
        const fresh = entry.videos.filter(v => !existingIds.has(v.id));
        if (fresh.length > 0) {
          const merged = [...existing, ...fresh];
          const replacement = `videos:${formatVideos(merged)}`;
          src = src.slice(0, field.start) + replacement + src.slice(field.bracketClose + 1);
          videosAdded += fresh.length;
          changed = true;
        }
      }
    }

    // ── Update date ──
    if (changed) {
      const idNeedle = `id:'${id}'`;
      const idPos = src.indexOf(idNeedle);
      if (idPos !== -1) {
        const nextId = src.indexOf("id:'", idPos + idNeedle.length);
        const entryEnd = nextId === -1 ? src.length : nextId;
        const slice = src.slice(idPos, entryEnd);
        const m = /updated:'[^']*'/.exec(slice);
        if (m) {
          const absPos = idPos + m.index;
          src = src.slice(0, absPos) + `updated:'${dateStr}'` + src.slice(absPos + m[0].length);
        }
      }
      updated++;
      process.stdout.write(`  ${id}: refs +${(entry.refs || []).length}, videos +${(entry.videos || []).length}\n`);
    }
  }

  fs.writeFileSync(dataPath, src, 'utf8');
  console.log(`\nDone: ${updated} keywords updated (refs +${refsAdded}, videos +${videosAdded})`);
}

main();
