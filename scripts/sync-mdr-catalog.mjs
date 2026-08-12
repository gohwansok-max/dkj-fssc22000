/**
 * MDR → doc-catalog.json **병합** 동기화
 * - 기존 카테고리(PRP/HACCP/교육 등) 문서 유지
 * - MDR에 있는 문서만 rev/status/sourcePath 갱신 또는 추가
 * node scripts/sync-mdr-catalog.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dkjRoot = path.resolve(__dirname, '..');
const mdrPath = path.join(dkjRoot, 'data/mdr-catalog.json');
const docPath = path.join(dkjRoot, 'data/doc-catalog.json');

const mdr = JSON.parse(fs.readFileSync(mdrPath, 'utf8'));
const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));

const beforeCount = (doc.documents || []).length;
if (beforeCount > 0 && beforeCount < 40) {
  console.error(
    `[ABORT] doc-catalog has only ${beforeCount} docs — likely stale GDrive cache. ` +
      'Run: python scripts/sync-fssc-catalog.py  (includes MDR merge)'
  );
  process.exit(2);
}

function titleFromPath(filePath, code) {
  if (!filePath) return code;
  const base = filePath.split('\\').pop().replace(/\.(docx|xlsx|pdf|hwp|pptx)$/i, '');
  const m = base.match(/_(.+?)_Rev\d/i) || base.match(/_(.+)_\d{8}$/);
  if (m) return m[1].replace(/_/g, ' ').trim();
  return code;
}

function fileType(filePath) {
  if (!filePath) return 'file';
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return ext || 'file';
}

const catAliases = {
  procedure: 'procedure',
  manual: 'manual',
  mdr: 'mdr',
  sop: 'sop',
  processmap: 'processmap',
  record: 'form',
};

let updated = 0;
let added = 0;
const byId = new Map((doc.documents || []).map((d) => [d.id, d]));

for (const e of mdr.entries) {
  const normalizedCategory = catAliases[e.category] || e.category;
  if (!['procedure', 'mdr', 'sop', 'processmap', 'manual', 'form'].includes(normalizedCategory)) {
    continue;
  }

  const id = e.code;

  let title = e.title;
  if (!title || title.length < 3 || title.startsWith('(')) {
    title = titleFromPath(e.filePath, e.code);
  }

  const existing = byId.get(id) || byId.get(e.code) || byId.get(e.id);
  if (existing) {
    if (existing.title && existing.title.length > (title || '').length) {
      title = existing.title;
    }
    existing.title = title;
    existing.rev = e.rev || existing.rev;
    existing.mdrRev = mdr.mdrRev;
    existing.mdrStatus = e.status || existing.mdrStatus;
    if (e.filePath) existing.sourcePath = e.filePath;
    existing.workflowStatus = existing.workflowStatus || '완료';
    if (normalizedCategory === 'sop') existing.workflowStatus = '완료';
    existing.highlights = existing.highlights || [e.status, mdr.mdrRev + ' 정본'];
    updated++;
  } else {
    const entry = {
      id,
      category: normalizedCategory,
      code: e.code,
      title,
      rev: e.rev,
      workflowStatus: '완료',
      fileType: fileType(e.filePath),
      mdrRev: mdr.mdrRev,
      mdrStatus: e.status,
      sourcePath: e.filePath,
      tags: [e.docType || normalizedCategory],
      highlights: [e.status || '운영중', mdr.mdrRev + ' 정본'],
    };
    doc.documents.push(entry);
    byId.set(id, entry);
    added++;
  }
}

const counts = {};
for (const d of doc.documents) {
  counts[d.category] = (counts[d.category] || 0) + 1;
}
for (const cat of doc.categories || []) {
  if (typeof counts[cat.id] === 'number') cat.count = counts[cat.id];
  if (cat.id === 'mdr') {
    cat.workflowStatus = '완료';
    cat.description = `MDR-001 ${mdr.mdrRev} 정본 · ${mdr.entryCount}건 등록`;
  }
  if (cat.id === 'sop') cat.workflowStatus = '완료';
}

doc.updatedAt = mdr.parsedAt;
doc.mdrSource = {
  file: path.basename(mdr.source || ''),
  rev: mdr.mdrRev,
  entryCount: mdr.entryCount,
  syncedAt: new Date().toISOString().slice(0, 10),
};

fs.writeFileSync(docPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');

const recPath = path.join(dkjRoot, 'data/record-catalog.json');
if (fs.existsSync(recPath)) {
  const rec = JSON.parse(fs.readFileSync(recPath, 'utf8'));
  const frMap = new Map();
  for (const e of mdr.entries) {
    if (e.id && e.id.startsWith('FR-')) frMap.set(e.id, e);
  }
  let n = 0;
  for (const r of rec.records || []) {
    const hit = frMap.get(r.id);
    if (hit) {
      r.rev = hit.rev;
      r.mdrCode = hit.code;
      r.sourcePath = hit.filePath;
      n++;
    }
  }
  rec.mdrRev = mdr.mdrRev;
  rec.updatedAt = mdr.parsedAt;
  fs.writeFileSync(recPath, JSON.stringify(rec, null, 2) + '\n', 'utf8');
  console.log('Updated', n, 'record revs from MDR');
}

console.log('Merged MDR into doc-catalog: updated=', updated, 'added=', added, 'total=', doc.documents.length);
console.log('MDR', mdr.mdrRev, 'entries', mdr.entryCount);
