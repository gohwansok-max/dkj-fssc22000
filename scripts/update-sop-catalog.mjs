#!/usr/bin/env node
/**
 * SOP 개정 완료 후 일괄 갱신
 * 1) data/sop-incoming/ 에 새 excerpt txt 넣기 (DKJ-WI-001.txt ...)
 * 2) node scripts/update-sop-catalog.mjs --status=완료
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dkjRoot = path.resolve(__dirname, '..');
const catalogPath = path.join(dkjRoot, 'data/doc-catalog.json');
const incomingDir = path.join(dkjRoot, 'data/sop-incoming');
const excerptDir = path.join(dkjRoot, 'data/excerpts');

const statusArg = process.argv.find((a) => a.startsWith('--status='));
const newStatus = statusArg ? statusArg.split('=')[1] : '완료';

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
let updated = 0;

if (fs.existsSync(incomingDir)) {
  fs.mkdirSync(excerptDir, { recursive: true });
  for (const f of fs.readdirSync(incomingDir).filter((x) => x.endsWith('.txt'))) {
    const id = path.basename(f, '.txt');
    fs.copyFileSync(path.join(incomingDir, f), path.join(excerptDir, f));
    const doc = catalog.documents.find((d) => d.id === id);
    if (doc) {
      doc.excerpt = `data/excerpts/${f}`;
      doc.workflowStatus = newStatus;
      updated++;
      console.log('excerpt + status:', id);
    }
  }
}

for (const doc of catalog.documents) {
  if (doc.category === 'sop') {
    if (doc.workflowStatus === '수정필요' && newStatus === '완료') {
      doc.workflowStatus = newStatus;
      updated++;
    }
  }
}

const sopCat = catalog.categories.find((c) => c.id === 'sop');
if (sopCat && newStatus === '완료') sopCat.workflowStatus = '완료';

catalog.updatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log('Done. Updated', updated, 'SOP entries. Category sop:', sopCat?.workflowStatus);
