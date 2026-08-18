(function (global) {
  'use strict';

  var EXCELJS_SRC = 'js/vendor/exceljs.bare.min.js';
  var HEADERS = [
    ['id', '관리 ID'], ['type', '관리 유형'], ['name', '세부 관리 항목'], ['target', '대상·설비·작업자명'],
    ['owner', '담당자'], ['dueDate', '다음 예정일'], ['cycleDays', '관리 주기(일)'], ['leadDays', '사전 알림(일)'],
    ['active', '사용 여부'], ['link', '관련 화면 링크'], ['memo', '비고']
  ];
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
  function readRow(sheet, rowNo, map, field, errors) {
    var column = map[HEADERS.filter(function (pair) { return pair[0] === field; })[0][1]];
    if (!column) return '';
    var value = cellValue(sheet.getRow(rowNo).getCell(column));
    if (value.formula) errors.push(rowNo + '행 ' + HEADERS.filter(function (pair) { return pair[0] === field; })[0][1] + ': 수식은 업로드할 수 없습니다.');
    return value.value;
  }
  function newId() { return 'pa_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }

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
      sheet.dataValidations.add('B2:B5000', { type: 'list', allowBlank: false, formulae: ['"계측기 검교정,자가품질검사,환경모니터링,보건증"'] });
      sheet.dataValidations.add('I2:I5000', { type: 'list', allowBlank: true, formulae: ['"사용,미사용"'] });
      sheet.getColumn(6).numFmt = 'yyyy-mm-dd';

      var guide = workbook.addWorksheet('작성 안내');
      guide.columns = [{ width: 22 }, { width: 70 }];
      guide.addRow(['정기 관리 항목 엑셀 업로드 안내', '']);
      guide.mergeCells('A1:B1');
      guide.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF006B3F' } };
      guide.getCell('A1').alignment = { vertical: 'middle' };
      guide.getRow(1).height = 30;
      [
        ['업로드 원칙', '관리 ID가 같은 행은 수정하고, 관리 ID가 비어 있는 행은 새로 등록합니다. 업로드 파일은 기존 항목을 삭제하지 않습니다.'],
        ['필수 입력', '관리 유형, 세부 관리 항목, 다음 예정일, 관리 주기(일), 사전 알림(일)을 입력하세요.'],
        ['관리 유형', '계측기 검교정 / 자가품질검사 / 환경모니터링 / 보건증 중 하나를 선택하세요.'],
        ['날짜 형식', 'YYYY-MM-DD 형식으로 입력하세요. 예: 2026-09-01'],
        ['주기·사전 알림', '관리 주기는 1~3650일, 사전 알림은 0~365일의 정수만 입력할 수 있습니다.'],
        ['사용 여부', '사용 또는 미사용으로 입력합니다. 비어 있으면 사용으로 처리합니다.'],
        ['주의', '보호를 위해 수식이 포함된 셀은 업로드되지 않습니다. 값만 입력하세요.']
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
    return loadExcelJs().then(function (ExcelJS) {
      return file.arrayBuffer().then(function (buffer) {
        var workbook = new ExcelJS.Workbook();
        return workbook.xlsx.load(buffer).then(function () {
          var sheet = worksheetFor(workbook), map = headerMap(sheet), errors = [], items = [], seen = {};
          ['관리 유형', '세부 관리 항목', '다음 예정일', '관리 주기(일)', '사전 알림(일)'].forEach(function (name) {
            if (!map[name]) errors.push('필수 열 “' + name + '”이 없습니다. 제공된 엑셀 양식을 사용하세요.');
          });
          if (errors.length) return { items: [], errors: errors, skipped: 0 };
          for (var rowNo = 2; rowNo <= sheet.rowCount; rowNo++) {
            var name = String(readRow(sheet, rowNo, map, 'name', errors) || '').trim();
            var typeRaw = readRow(sheet, rowNo, map, 'type', errors);
            var dueRaw = readRow(sheet, rowNo, map, 'dueDate', errors);
            var cycleRaw = readRow(sheet, rowNo, map, 'cycleDays', errors);
            var leadRaw = readRow(sheet, rowNo, map, 'leadDays', errors);
            var id = String(readRow(sheet, rowNo, map, 'id', errors) || '').trim();
            var target = String(readRow(sheet, rowNo, map, 'target', errors) || '').trim();
            var owner = String(readRow(sheet, rowNo, map, 'owner', errors) || '').trim();
            var activeRaw = readRow(sheet, rowNo, map, 'active', errors);
            var link = String(readRow(sheet, rowNo, map, 'link', errors) || '').trim();
            var memo = String(readRow(sheet, rowNo, map, 'memo', errors) || '').trim();
            var allBlank = !name && !String(typeRaw || '').trim() && !String(dueRaw || '').trim() && !String(cycleRaw || '').trim() && !String(leadRaw || '').trim() && !id;
            if (allBlank) continue;
            var type = typeCode(typeRaw), dueDate = dateText(dueRaw), cycleDays = numeric(cycleRaw), leadDays = numeric(leadRaw), active = activeValue(activeRaw);
            if (!type) errors.push(rowNo + '행 관리 유형: 계측기 검교정, 자가품질검사, 환경모니터링, 보건증 중 하나를 입력하세요.');
            if (!name || name.length > 80) errors.push(rowNo + '행 세부 관리 항목: 1~80자로 입력하세요.');
            if (!dueDate) errors.push(rowNo + '행 다음 예정일: YYYY-MM-DD 형식의 올바른 날짜를 입력하세요.');
            if (!Number.isInteger(cycleDays) || cycleDays < 1 || cycleDays > 3650) errors.push(rowNo + '행 관리 주기: 1~3650일의 정수를 입력하세요.');
            if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 365) errors.push(rowNo + '행 사전 알림: 0~365일의 정수를 입력하세요.');
            if (active === null) errors.push(rowNo + '행 사용 여부: 사용 또는 미사용으로 입력하세요.');
            if (target.length > 80 || owner.length > 40 || link.length > 200 || memo.length > 400) errors.push(rowNo + '행: 대상·담당자·링크·비고의 글자 수 제한을 확인하세요.');
            var recordId = id || newId();
            if (seen[recordId]) errors.push(rowNo + '행 관리 ID: 파일 안에서 중복되었습니다.');
            seen[recordId] = true;
            items.push({ id: recordId, type: type, name: name, target: target, owner: owner, dueDate: dueDate, cycleDays: cycleDays, leadDays: leadDays, active: active, link: link, memo: memo });
          }
          return { items: items, errors: errors, skipped: Math.max(0, sheet.rowCount - 1 - items.length) };
        });
      });
    });
  }

  global.DkjPeriodicAlertExcel = { downloadTemplate: downloadTemplate, downloadItems: downloadItems, parseFile: parseFile, headers: HEADERS.slice() };
})(window);
