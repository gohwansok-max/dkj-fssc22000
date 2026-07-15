#!/usr/bin/env node
/**
 * Build PDF manifest from assets/pdf + doc-assets map.
 * node scripts/build-pdf-manifest.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dkjRoot = path.resolve(__dirname, '..');

const pdfDir = path.join(dkjRoot, 'assets', 'pdf');
const docAssetsPath = path.join(dkjRoot, 'data', 'doc-assets.json');
const manifestPath = path.join(dkjRoot, 'data', 'pdf-manifest.json');
const bundlePath = path.join(dkjRoot, 'js', 'pdf-manifest.bundle.js');

const filesMap = new Map();

if (fs.existsSync(pdfDir)) {
  for (const name of fs.readdirSync(pdfDir)) {
    if (!name.toLowerCase().endsWith('.pdf')) continue;
    const id = path.basename(name, '.pdf');
    filesMap.set(id, { id, pdf: `assets/pdf/${name}` });
  }
}

if (fs.existsSync(docAssetsPath)) {
  const raw = fs.readFileSync(docAssetsPath, 'utf8').replace(/^\uFEFF/, '');
  const docAssets = JSON.parse(raw);
  for (const [id, entry] of Object.entries(docAssets.map || {})) {
    if (entry && entry.pdf) {
      filesMap.set(id, { id, pdf: entry.pdf });
    }
  }
}

const manifest = {
  updatedAt: new Date().toISOString().slice(0, 10),
  files: Array.from(filesMap.values()).sort((a, b) => a.id.localeCompare(b.id))
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(bundlePath, 'window.DKJ_PDF_MANIFEST=' + JSON.stringify(manifest, null, 2) + ';\n', 'utf8');

console.log('Built pdf-manifest.json:', manifest.files.length, 'files');
