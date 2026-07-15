#!/usr/bin/env node
/** Parse MDR-001 Rev4 xlsx -> JSON summary */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const MDR_PATH = process.argv[2] || String.raw`[REDACTED]`;

if (!fs.existsSync(MDR_PATH)) {
  console.error('NOT_FOUND', MDR_PATH);
  process.exit(1);
}

// minimal xlsx read via zip
import { createRequire } from 'module';
// use pure zip parse - no xlsx lib
import { execSync } from 'child_process';

const tmpScript = `
import zipfile, re, json, sys
path = sys.argv[1]
z = zipfile.ZipFile(path)
ss = z.read('xl/sharedStrings.xml').decode('utf-8')
strings = re.findall(r'<t[^>]*>([^<]*)</t>', ss)
wb = z.read('xl/workbook.xml').decode('utf-8')
sheets = re.findall(r'<sheet[^>]+name="([^"]+)"', wb)
rows_out = []
for si in range(1, min(len(sheets)+1, 6)):
    try:
        sh = z.read(f'xl/worksheets/sheet{si}.xml').decode('utf-8')
    except:
        continue
    sheet_name = sheets[si-1] if si-1 < len(sheets) else f'sheet{si}'
    # inline strings and shared
    for m in re.finditer(r'<c r="([A-Z]+)(\d+)"([^>]*)>(?:<v>([^<]*)</v>|<is><t>([^<]*)</t></is>)', sh):
        col, row, attrs, v, inline = m.groups()
        val = inline if inline else v
        if attrs and 't="s"' in attrs and val:
            try:
                val = strings[int(val)]
            except:
                pass
        if val and str(val).strip():
            rows_out.append({'sheet': sheet_name, 'cell': col+row, 'value': str(val).strip()})
print(json.dumps({'sheets': sheets, 'cells': rows_out[:500], 'string_count': len(strings)}, ensure_ascii=False))
`;

import os from 'os';
const pyFile = path.join(os.tmpdir(), 'parse_mdr.py');
fs.writeFileSync(pyFile, tmpScript);
const out = execSync(`python "${pyFile}" "${MDR_PATH}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
const data = JSON.parse(out);
console.log('sheets:', data.sheets);
console.log('strings:', data.string_count);
// find document codes
const codes = data.cells.filter(c => /^(DKJ-P|DKJ-WI|FR-|MDR|DKJ-H|DKJ-S|DOC-)/.test(c.value) || c.value.includes('절차서') || c.value.includes('Rev'));
console.log('sample codes:', codes.slice(0, 60).map(c => c.sheet + ' ' + c.cell + ' ' + c.value).join('\n'));
