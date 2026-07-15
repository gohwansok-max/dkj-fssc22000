#!/usr/bin/env node
/**
 * Sync DKJ web excerpts from FSSC benchmark extract_DKJ_*.txt
 * Usage: node scripts/sync-excerpts.mjs [--max-lines=120]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dkjRoot = path.resolve(__dirname, '..');
const sources = JSON.parse(fs.readFileSync(path.join(dkjRoot, 'data/asset-sources.json'), 'utf8'));
const maxLines = Number(process.argv.find((a) => a.startsWith('--max-lines='))?.split('=')[1] || 120);

const extractDir = path.join(sources.fsscRoot, sources.paths.benchmarkExtracts);
const outDir = path.join(dkjRoot, sources.webAssets.excerpts);

const map = {
  'DKJ-P-01': 'extract_DKJ_DKJ-P-01',
  'DKJ-P-03': 'extract_DKJ_DKJ-P-03',
  'DKJ-P-04': 'extract_DKJ_DKJ-P-04',
  'DKJ-P-05': 'extract_DKJ_DKJ-P-05',
  'DKJ-P-06': 'extract_DKJ_DKJ-P-06',
  'DKJ-P-07': 'extract_DKJ_DKJ-P-07',
  'DKJ-P-08': 'extract_DKJ_DKJ-P-08',
  'DKJ-P-10': 'extract_DKJ_DKJ-P-10',
  'DKJ-P-12': 'extract_DKJ_DKJ-P-12',
  'DKJ-P-16': 'extract_DKJ_DKJ-P-16',
  'DKJ-P-17': 'extract_DKJ_DKJ-P-17',
  'DKJ-P-18': 'extract_DKJ_DKJ-P-18',
};

if (!fs.existsSync(extractDir)) {
  console.error('Benchmark folder not found:', extractDir);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(extractDir);
let count = 0;

for (const [code, prefix] of Object.entries(map)) {
  const srcName = files.find((f) => f.startsWith(prefix));
  if (!srcName) {
    console.warn('skip', code);
    continue;
  }
  const lines = fs.readFileSync(path.join(extractDir, srcName), 'utf8').split(/\r?\n/).slice(0, maxLines);
  const footer = `\n\n---\n[web excerpt max ${maxLines} lines — see approved docx/PDF for official text]`;
  fs.writeFileSync(path.join(outDir, `${code}.txt`), lines.join('\n') + footer, 'utf8');
  console.log('OK', code, '<-', srcName);
  count++;
}

// Patch doc-catalog excerpt paths
const catalogPath = path.join(dkjRoot, 'data/doc-catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
for (const doc of catalog.documents) {
  if (map[doc.id] && fs.existsSync(path.join(outDir, `${doc.id}.txt`))) {
    doc.excerpt = `data/excerpts/${doc.id}.txt`;
  }
}
catalog.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log('Updated doc-catalog.json,', count, 'excerpts');
