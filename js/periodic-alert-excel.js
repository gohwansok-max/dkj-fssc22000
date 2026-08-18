(function (global) {
  'use strict';

  var EXCELJS_SRC = 'js/vendor/exceljs.bare.min.js';
  var MAX_FILE_SIZE = 5 * 1024 * 1024;
  var MAX_DATA_ROWS = 1000;
  var HEADERS = [
    ['id', '관리 ID'], ['type', '관리 유형'], ['name', '세부 관리 항목'], ['target', '대상·설비·작업자명'],
    ['owner', '담당자'], ['dueDate', '다음 예정일'], ['cycleDays', '관리 주기(일)'], ['leadDays', '사전 알림(일)'],
    ['active', '사용 여부'], ['link', '관련 화면 링크'], ['memo', '비고']
  ];
  var REQUIRED_FIELDS = ['type', 'name', 'dueDate', 'cycleDays', 'leadDays'];
  var TYPES = {
    calibration: '계측기 검교정',
    'self-quality': '자가품질검사',
    environment: '환경모니터링',
    'health-certificate': '보건증'
  };
  var TYPE_ALIASES = {
    calibration: 'calibration', '계측기 검교정': 'calibration', '검교정': 'calibration',
    'self-quality': 'self-quality', '자가품질검사': 'self-quality', '자가 품질 검사': 'self-quality',
    environment: 'environment', '환경모니터링': 'environment', '환경 모니터링': 'environment',
    'health-certificate': 'health-certificate', '보건증': 'health-certificate', '건강진단결과서': 'health-certificate'
  };

  function loadExcelJs() {
    if (global.ExcelJS) return Promise.resolve(global.ExcelJS);
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = EXCELJS_SRC;
      script.onload = function () { global.ExcelJS ? resolve(global.ExcelJS) : reject(new Error('EXCELJS_LOAD_FAILED')); };
      script.onerror = function () { reject(new Error('EXCELJS_LOAD_FAILED')); };
      document.head.appendChild(script);
    });
  }
  function stamp() {
    var date = new Date();
    function pad(value) { return String(value).padStart(2, '0'); }
    return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate()) + '_' + pad(date.getHours()) + pad(date.getMinutes());
  }
  function download(blob, filename) {
    var url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function sanitize(value) {
    var text = String(value == null ? '' : value);
    return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
  }
  function labelFor(field) {
    var pair = HEADERS.filter(function (item) { return item[0] === field; })[0];
    return pair ? pair[1] : field;
  }
  function setHeader(sheet) {
    var row = sheet.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF009A44' } };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 24;
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };
  }
  function setWidths(sheet) {
    [18, 18, 25, 26, 18, 15, 15, 15, 12, 32, 46].forEach(function (width, index) { sheet.getColumn(index + 1).width = width; });
  }
  function typeCode(value) {
    var raw = String(value == null ? '' : value).trim();
    return TYPE_ALIASES[raw] || '';
  }
  function dateText(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0') + '-' + String(value.getDate()).padStart(2, '0');
    }
    var raw = String(value == null ? '' : value).trim().replace(/\./g, '-').replace(/\//g, '-');
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) return '';
    var parts = raw.split('-'), date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (date.getFullYear() !== Number(parts[0]) || date.getMonth() !== Number(parts[1]) - 1 || date.getDate() !== Number(parts[2])) return '';
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function numeric(value) {
    var text = String(value == null ? '' : value).trim().replace(/,/g, '');
    if (!/^\d+$/.test(text)) return NaN;
    return Number(text);
  }
  function activeValue(value) {
    var text = String(value == null ? '' : value).trim().toLowerCase();
    if (!text || ['사용', 'y', 'yes', 'true', '1', '활성'].indexOf(text) >= 0) return true;
    if (['미사용', 'n', 'no', 'false', '0', '비활성'].indexOf(text) >= 0) return false;
    return null;
  }
  function safeText(value) { return String(value == null ? '' : value).trim(); }
  function hasUnsafeLink(value) { return /^(javascript|data|vbscript):/i.test(String(value || '').trim()); }
  function cellValue(cell) {
    var value = cell && cell.value;
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'formula')) return { formula: true, value: '' };
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'text')) value = value.text;
    return { formula: false, value: value == null ? '' : value };
  }
  function worksheetFor(workbook) {
    return workbook.getWorksheet('정기 관리 항목') || workbook.getWorksheet('작성 양식') || workbook.worksheets[0];
  }
  function headerMap(sheet) {
    var map = {};
    sheet.getRow(1).eachCell(function (cell, number) {
      var value = cellValue(cell);
      if (!value.formula) map[String(value.value || '').trim()] = number;
    });
    return map;
  }
  function newId() { return 'pa_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }
  function issue(list, row, field, message, value) {
    list.push({ row: row, field: field || '파일', label: labelFor(field || '파일'), message: message, value: value == null ? '' : String(value) });
  }
  function errorText(error) { return error.row + '행 ' + error.label + ': ' + error.message; }

  function writeWorkbook(items, isTemplate) {
    return loadExcelJs().then(function (ExcelJS) {
      var workbook = new ExcelJS.Workbook();
      workbook.creator = '동김제농협 산지유통센터 스마트 HACCP';
      workbook.created = new Date();
      var sheet = workbook.addWorksheet(isTemplate ? '작성 양식' : '정기 관리 항목');
      sheet.addRow(HEADERS.map(function (pair) { return pair[1]; }));
      setHeader(sheet); setWidths(sheet);
      if (!isTemplate) {
        (items || []).forEach(function (item) {
          sheet.addRow(HEADERS.map(function (pair) {
            var key = pair[0], value = item[key];
            if (key === 'type') value = TYPES[value] || value || '';
            if (key === 'active') value = item.active === false ? '미사용' : '사용';
            return sanitize(value);
          }));
        });
      }
      sheet.dataValidations.add('B2:B1001', { type: 'list', allowBlank: false, formulae: ['"계측기 검교정,자가품질검사,환경모니터링,보건증"'] });
      sheet.dataValidations.add('I2:I1001', { type: 'list', allowBlank: true, formulae: ['"사용,미사용"'] });
      sheet.getColumn(6).numFmt = 'yyyy-mm-dd';

      var guide = workbook.addWorksheet('작성 안내');
      guide.columns = [{ width: 22 }, { width: 78 }];
      guide.addRow(['정기 관리 항목 엑셀 업로드 안내', '']);
      guide.mergeCells('A1:B1');
      guide.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF006B3F' } };
      guide.getCell('A1').alignment = { vertical: 'middle' };
      guide.getRow(1).height = 30;
      [
        ['업로드 원칙', '모든 데이터 행이 검증을 통과할 때만 일괄 반영합니다. 오류가 한 행이라도 있으면 전체 업로드가 차단됩니다.'],
        ['관리 ID', '같은 ID는 기존 항목 수정, 빈 ID는 신규 등록입니다. 같은 파일 안에서는 동일 ID를 중복 입력할 수 없습니다.'],
        ['필수 입력', '관리 유형, 세부 관리 항목, 다음 예정일, 관리 주기(일), 사전 알림(일)을 입력하세요.'],
        ['관리 유형', '계측기 검교정 / 자가품질검사 / 환경모니터링 / 보건증 중 하나를 선택하세요.'],
        ['날짜 형식', 'YYYY-MM-DD 형식의 실제 날짜를 입력하세요. 예: 2026-09-01'],
        ['주기·사전 알림', '관리 주기는 1~3650일, 사전 알림은 0~365일의 정수만 입력할 수 있습니다.'],
        ['사용 여부', '사용 또는 미사용으로 입력합니다. 비어 있으면 사용으로 처리합니다.'],
        ['용량·행 수', 'xlsx 파일은 5MB 이하, 데이터 행은 최대 1,000행까지 업로드할 수 있습니다.'],
        ['수식·링크', '보호를 위해 수식이 포함된 셀과 javascript·data 형식 링크는 업로드할 수 없습니다.'],
        ['오류 처리', '오류가 있으면 화면의 행별 오류 목록을 확인하고 “오류 목록 다운로드”로 수정용 파일을 받으세요.']
      ].forEach(function (row) { guide.addRow(row); });
      guide.getColumn(1).eachCell(function (cell) { cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF5ED' } }; });
      guide.eachRow(function (row) { row.alignment = { vertical: 'top', wrapText: true }; });
      guide.views = [{ showGridLines: false }];

      return workbook.xlsx.writeBuffer().then(function (buffer) {
        download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          '동김제_정기관리_' + (isTemplate ? '업로드양식' : '항목목록') + '_' + stamp() + '.xlsx');
        return (items || []).length;
      });
    });
  }

  function downloadTemplate() { return writeWorkbook([], true); }
  function downloadItems(items) { return writeWorkbook(items || [], false); }

  function parseFile(file) {
    if (!file) return Promise.reject(new Error('FILE_REQUIRED'));
    if (!/\.xlsx$/i.test(file.name || '')) return Promise.reject(new Error('XLSX_ONLY'));
    if (file.size > MAX_FILE_SIZE) return Promise.reject(new Error('FILE_TOO_LARGE'));
    return loadExcelJs().then(function (ExcelJS) {
      return file.arrayBuffer().then(function (buffer) {
        var workbook = new ExcelJS.Workbook();
        return workbook.xlsx.load(buffer).then(function () {
          var sheet = worksheetFor(workbook), map = headerMap(sheet), errors = [], items = [], rows = [], seen = {}, skipped = 0;
          if (!sheet) return { items: [], errors: [{ row: 0, field: '파일', label: '파일', message: '읽을 수 있는 워크시트를 찾지 못했습니다.', value: '' }], rows: [], skipped: 0, totalRows: 0 };
          REQUIRED_FIELDS.forEach(function (field) {
            if (!map[labelFor(field)]) issue(errors, 1, field, '필수 열이 없습니다. 제공된 엑셀 양식을 사용하세요.');
          });
          var dataRows = Math.max(0, sheet.rowCount - 1);
          if (dataRows > MAX_DATA_ROWS) issue(errors, 0, '파일', '데이터 행은 최대 ' + MAX_DATA_ROWS.toLocaleString('ko-KR') + '행까지 업로드할 수 있습니다.');
          if (errors.length) return { items: [], errors: errors, rows: [], skipped: 0, totalRows: dataRows };

          for (var rowNo = 2; rowNo <= sheet.rowCount; rowNo++) {
            var rowErrors = [];
            var source = {};
            HEADERS.forEach(function (pair) {
              var field = pair[0], header = pair[1], col = map[header];
              if (!col) { source[field] = ''; return; }
              var value = cellValue(sheet.getRow(rowNo).getCell(col));
              source[field] = value.value;
              if (value.formula) issue(rowErrors, rowNo, field, '수식이 포함되어 있어 업로드할 수 없습니다. 값만 입력하세요.');
            });

            var name = safeText(source.name), typeRaw = source.type, dueRaw = source.dueDate, cycleRaw = source.cycleDays, leadRaw = source.leadDays;
            var id = safeText(source.id), target = safeText(source.target), owner = safeText(source.owner), activeRaw = source.active, link = safeText(source.link), memo = safeText(source.memo);
            var allBlank = !name && !safeText(typeRaw) && !safeText(dueRaw) && !safeText(cycleRaw) && !safeText(leadRaw) && !id && !target && !owner && !link && !memo;
            if (allBlank) { skipped++; continue; }

            var type = typeCode(typeRaw), dueDate = dateText(dueRaw), cycleDays = numeric(cycleRaw), leadDays = numeric(leadRaw), active = activeValue(activeRaw);
            if (!type) issue(rowErrors, rowNo, 'type', '허용된 관리 유형 중 하나를 입력하세요.');
            if (!name || name.length > 80) issue(rowErrors, rowNo, 'name', '1~80자로 입력하세요.');
            if (!dueDate) issue(rowErrors, rowNo, 'dueDate', 'YYYY-MM-DD 형식의 올바른 날짜를 입력하세요.');
            if (!Number.isInteger(cycleDays) || cycleDays < 1 || cycleDays > 3650) issue(rowErrors, rowNo, 'cycleDays', '1~3650일의 정수를 입력하세요.');
            if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 365) issue(rowErrors, rowNo, 'leadDays', '0~365일의 정수를 입력하세요.');
            if (active === null) issue(rowErrors, rowNo, 'active', '사용 또는 미사용으로 입력하세요.');
            if (id.length > 80) issue(rowErrors, rowNo, 'id', '80자 이하로 입력하세요.');
            if (target.length > 80) issue(rowErrors, rowNo, 'target', '80자 이하로 입력하세요.');
            if (owner.length > 40) issue(rowErrors, rowNo, 'owner', '40자 이하로 입력하세요.');
            if (link.length > 200) issue(rowErrors, rowNo, 'link', '200자 이하로 입력하세요.');
            if (hasUnsafeLink(link)) issue(rowErrors, rowNo, 'link', 'javascript 또는 data 형식 링크는 사용할 수 없습니다.');
            if (memo.length > 400) issue(rowErrors, rowNo, 'memo', '400자 이하로 입력하세요.');
            if (id && seen[id]) issue(rowErrors, rowNo, 'id', '파일 안에서 중복되었습니다. 관리 ID는 한 번만 사용하세요.');
            if (id) seen[id] = true;

            rows.push({ row: rowNo, source: source, errors: rowErrors.slice() });
            if (rowErrors.length) {
              Array.prototype.push.apply(errors, rowErrors);
              continue;
            }
            items.push({ id: id || newId(), type: type, name: name, target: target, owner: owner, dueDate: dueDate, cycleDays: cycleDays, leadDays: leadDays, active: active, link: link, memo: memo });
          }
          return { items: items, errors: errors, rows: rows, skipped: skipped, totalRows: dataRows, validRows: items.length, invalidRows: rows.filter(function (row) { return row.errors.length; }).length };
        });
      });
    });
  }

  function downloadErrorReport(result) {
    result = result || {};
    return loadExcelJs().then(function (ExcelJS) {
      var workbook = new ExcelJS.Workbook();
      workbook.creator = '동김제농협 산지유통센터 스마트 HACCP';
      workbook.created = new Date();
      var summary = workbook.addWorksheet('검증 요약');
      summary.columns = [{ width: 24 }, { width: 72 }];
      summary.addRow(['엑셀 업로드 검증 결과', '']);
      summary.mergeCells('A1:B1');
      summary.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFB42318' } };
      summary.getCell('A1').alignment = { vertical: 'middle' };
      summary.getRow(1).height = 30;
      [
        ['검증 시각', new Date().toLocaleString('ko-KR')],
        ['전체 데이터 행', result.totalRows || 0],
        ['오류 행', result.invalidRows || 0],
        ['검증 통과 행', result.validRows || 0],
        ['빈 행 건너뜀', result.skipped || 0],
        ['반영 상태', '오류가 있어 업로드가 차단되었습니다. 오류 목록을 수정한 뒤 다시 업로드하세요.']
      ].forEach(function (row) { summary.addRow(row); });
      summary.getColumn(1).eachCell(function (cell) { cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE9E6' } }; });
      summary.views = [{ showGridLines: false }];

      var sheet = workbook.addWorksheet('오류 목록');
      sheet.columns = [{ width: 10 }, { width: 22 }, { width: 22 }, { width: 28 }, { width: 20 }, { width: 58 }];
      sheet.addRow(['엑셀 행', '관리 ID', '관리 유형', '세부 관리 항목', '오류 필드', '오류 내용']);
      setHeader(sheet);
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } };
      (result.errors || []).forEach(function (entry) {
        var row = (result.rows || []).filter(function (item) { return item.row === entry.row; })[0];
        var source = (row && row.source) || {};
        sheet.addRow([entry.row || '-', sanitize(source.id || ''), sanitize(source.type || ''), sanitize(source.name || ''), entry.label || entry.field || '', entry.message || '']);
      });
      sheet.eachRow(function (row, number) { if (number > 1) row.alignment = { vertical: 'top', wrapText: true }; });

      return workbook.xlsx.writeBuffer().then(function (buffer) {
        download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), '동김제_정기관리_업로드오류목록_' + stamp() + '.xlsx');
        return (result.errors || []).length;
      });
    });
  }

  global.DkjPeriodicAlertExcel = {
    downloadTemplate: downloadTemplate,
    downloadItems: downloadItems,
    parseFile: parseFile,
    downloadErrorReport: downloadErrorReport,
    headers: HEADERS.slice(),
    limits: { maxFileSize: MAX_FILE_SIZE, maxRows: MAX_DATA_ROWS },
    errorText: errorText
  };
})(window);
