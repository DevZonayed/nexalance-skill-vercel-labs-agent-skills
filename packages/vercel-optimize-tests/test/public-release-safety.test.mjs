import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const SKILL_DIR = join(ROOT, 'skills', 'vercel-optimize');

test('public release safety: metadata version matches skill frontmatter', async () => {
  const skill = await readFile(join(SKILL_DIR, 'SKILL.md'), 'utf8');
  const metadata = JSON.parse(await readFile(join(SKILL_DIR, 'metadata.json'), 'utf8'));
  const version = skill.match(/metadata:\s*\n\s*version:\s*"([^"]+)"/)?.[1];
  assert.equal(metadata.version, version);
});

test('public release safety: docs avoid private customer names and stale artifact names', async () => {
  const files = await listFiles(SKILL_DIR);
  const publicDocs = files.filter((file) => /\.(?:md|json)$/.test(file));
  const forbidden = /\bteam-field-engineering\b|ship-2026|\/Users\/phamous|gated\.json/;

  for (const file of publicDocs) {
    const text = await readFile(file, 'utf8');
    assert.doesNotMatch(text, forbidden, file);
  }
});

test('public release safety: docs library uses verified current URLs', async () => {
  const text = await readFile(join(SKILL_DIR, 'references', 'docs-library.json'), 'utf8');
  const staleUrls = [
    'https://vercel.com/docs/functions/fluid-compute',
    'https://vercel.com/docs/functions/serverless-functions',
    'https://vercel.com/docs/functions/regions',
    'https://vercel.com/docs/observability/anomaly-detection',
    'https://vercel.com/docs/edge-network/bandwidth',
    'https://vercel.com/docs/security/bot-protection',
    'https://vercel.com/docs/limits/limits-and-quotas',
    'https://nextjs.org/docs/app/api-reference/functions/dynamic',
  ];

  for (const url of staleUrls) {
    assert.doesNotMatch(text, new RegExp(escapeRegExp(url)), url);
  }
});

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(path));
    else out.push(path);
  }
  return out;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
