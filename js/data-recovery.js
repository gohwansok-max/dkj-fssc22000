/* 기록 복구 점검 — 같은 기록의 사본(IndexedDB · localStorage 이전 시점 백업)을 비교한다.
 * 조회는 읽기 전용이다. 복원은 버튼을 눌렀을 때만, 잠기지 않은 기록에 한해
 * DkjRecordStore.save 를 거쳐(감사이력·잠금 훅 유지) 같은 id 로 덮어쓴다. */
(function (global) {
  var KEY_RE = /^dkj:records:(.+):(list|draft):v1$/;
  var SRC_IDB = 'IndexedDB(현재)';
  var SRC_LS = 'localStorage(이전 시점 백업)';
  var SRC_HIST = '이전 버전(덮어쓰기·삭제 전)';
  var HIST_RE = /^dkj:history:(.+):v1$/;

  // 사진은 data:image 문자열, 시간은 time / *Time 키의 비어 있지 않은 문자열로 센다.
  function scan(v, acc, key) {
    if (typeof v === 'string') {
      if (v.indexOf('data:image/') === 0) acc.photos++;
      else if (v && /^(time|.*Time)$/.test(key || '')) acc.times++;
    } else if (Array.isArray(v)) {
      v.forEach(function (x) { scan(x, acc, key); });
    } else if (v && typeof v === 'object') {
      Object.keys(v).forEach(function (k) { scan(v[k], acc, k); });
    }
    return acc;
  }

  function describe(rec, raw) {
    var acc = scan(rec, {photos: 0, times: 0}, '');
    return {rec: rec, photos: acc.photos, times: acc.times, kb: Math.round(raw.length / 1024),
      updatedAt: rec.updatedAt || '', deleted: !!rec.deleted, locked: !!rec.locked};
  }

  // 시각은 한국 시간으로 보여 준다(저장값은 UTC 라 그대로 읽으면 9시간 어긋난다).
  function kst(iso) {
    var t = Date.parse(iso);
    if (!isFinite(t)) return String(iso || '').slice(0, 19).replace('T', ' ');
    var p = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false}).format(new Date(t));
    return p;
  }
  function whoDeleted(rec) {
    var who = [rec.deletedBy, rec.deletedByEmpId ? '(' + rec.deletedByEmpId + ')' : ''].filter(Boolean).join('');
    return '삭제: ' + (who || '삭제자 기록 없음') + ' · ' + kst(rec.deletedAt || rec.updatedAt);
  }

  async function readAll() {
    var keys = Object.create(null);
    (await global.DkjStore.keys()).forEach(function (k) { if (KEY_RE.test(k)) keys[k] = 1; });
    for (var i = 0; i < global.localStorage.length; i++) {
      var k = global.localStorage.key(i);
      if (KEY_RE.test(k)) keys[k] = 1;
    }
    var groups = Object.create(null); // "formId|recordId" -> {formId, id, kind, copies:[]}
    function groupOf(formId, kind, id) {
      var gk = formId + '|' + kind + '|' + id;
      return groups[gk] || (groups[gk] = {formId: formId, kind: kind, id: id, copies: []});
    }
    for (var key of Object.keys(keys)) {
      var m = KEY_RE.exec(key), formId = m[1], kind = m[2];
      var sources = [[SRC_IDB, await global.DkjStore.get(key)], [SRC_LS, global.localStorage.getItem(key)]];
      sources.forEach(function (pair) {
        var raw = pair[1];
        if (typeof raw !== 'string' || !raw) return;
        var data;
        try { data = JSON.parse(raw); } catch (e) { return; }
        var rows = kind === 'list' ? (Array.isArray(data) ? data : []) : (data ? [data] : []);
        rows.forEach(function (rec) {
          if (!rec || typeof rec !== 'object') return;
          var id = kind === 'list' ? rec.id : '(임시본)';
          if (!id) return;
          var g = groupOf(formId, kind, id);
          var d = describe(rec, JSON.stringify(rec));
          d.source = pair[0];
          g.copies.push(d);
        });
      });
    }
    // 저장·삭제·동기화 병합으로 덮어쓰이기 직전에 보관한 이전 버전들
    for (var hkey of (await global.DkjStore.keys())) {
      var hm = HIST_RE.exec(hkey);
      if (!hm) continue;
      var hraw = await global.DkjStore.get(hkey), entries = [];
      try { entries = JSON.parse(hraw) || []; } catch (e) {}
      entries.forEach(function (en) {
        if (!en || !en.rec || !en.recordId) return;
        var d = describe(en.rec, JSON.stringify(en.rec));
        d.source = SRC_HIST + ' · ' + kst(en.savedAt) + ' · ' + (en.reason === 'delete' ? '삭제' : en.reason === 'sync' ? '동기화' : '저장');
        d.isHistory = true;
        groupOf(hm[1], 'list', en.recordId).copies.push(d);
      });
    }
    return Object.keys(groups).map(function (k) { return groups[k]; });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
    });
  }
  function label(rec) {
    return [rec.workDate || rec.docDate || rec.checkDate || '', rec.productName || rec.title || ''].filter(Boolean).join(' · ');
  }
  function score(c) { return c.photos * 1000 + c.times; }

  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  }

  var groupsCache = [];

  function render(groups) {
    // 삭제된 기록에 되살릴 수 있는 사본이 있는 것을 맨 앞에, 그다음 사진·시간 수가 다른 것을 앞에 둔다.
    var rows = groups.filter(function (g) { return g.copies.length > 0; }).map(function (g) {
      var scores = g.copies.map(score);
      g.differs = g.copies.length > 1 && Math.max.apply(null, scores) !== Math.min.apply(null, scores);
      var idb = g.copies.filter(function (x) { return x.source === SRC_IDB; })[0];
      g.deletedNow = g.kind === 'list' && !!(idb && idb.deleted);
      var alive = g.copies.filter(function (x) { return !x.deleted; });
      g.recoverable = g.deletedNow && alive.length > 0;
      // 삭제 복구는 가장 최근에 수정된 사본을 권장한다.
      g.newestAlive = alive.slice().sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); })[0] || null;
      return g;
    }).sort(function (a, b) {
      return (b.recoverable - a.recoverable) || (b.differs - a.differs) ||
        String(b.copies[0].updatedAt).localeCompare(String(a.copies[0].updatedAt));
    });
    groupsCache = rows; // 버튼의 data-* 인덱스는 정렬된 이 배열 기준이다.
    var diff = rows.filter(function (g) { return g.differs; }).length;
    var rec = rows.filter(function (g) { return g.recoverable; }).length;
    var del = rows.filter(function (g) { return g.deletedNow; }).length;
    document.getElementById('msg').innerHTML = '기록·임시본 ' + rows.length + '건 · 삭제된 기록 ' + del + '건 중 <strong>되살릴 수 있는 사본이 있는 것 ' + rec + '건</strong> · ' +
      '사본 간 사진·시간 수가 다른 것 ' + diff + '건' +
      ((rec || diff) ? ' — 초록색 행이 권장 사본입니다.' : '. 복원할 차이는 이 기기에서 발견되지 않았습니다.');
    var html = '<div class="card"><div class="wrap"><table><thead><tr><th>서식</th><th>기록</th><th>저장 위치</th><th>수정시각(한국)</th><th>사진</th><th>시간 입력</th><th>크기</th><th></th></tr></thead><tbody>';
    rows.forEach(function (g, gi) {
      var best = Math.max.apply(null, g.copies.map(score));
      g.copies.forEach(function (c, ci) {
        var isBest = g.recoverable ? c === g.newestAlive : (g.differs && score(c) === best);
        var acts = '<button class="btn" data-dl="' + gi + ':' + ci + '">JSON 받기</button>';
        var idbCopy = g.copies.filter(function (x) { return x.source === SRC_IDB; })[0];
        // 삭제된 기록은 어떤 사본이든(사진·시간이 없는 서식 포함) 되살릴 수 있다.
        // 삭제되지 않은 기록은 현재본이 잠기지 않았고 사진·시간이 더 많이 남은 사본만 복원 대상이다.
        var canRestore = g.kind === 'list' && !c.deleted && c.source !== SRC_IDB && (g.deletedNow ||
          (isBest && !(idbCopy && !idbCopy.deleted && idbCopy.locked) && (c.source === SRC_LS ? !!idbCopy : !!c.isHistory)));
        if (canRestore) {
          acts += ' <button class="btn primary" data-restore="' + gi + ':' + ci + '">' + (g.deletedNow ? '삭제 복구' : '이 사본으로 복원') + '</button>';
        }
        html += '<tr class="' + (isBest ? 'best' : '') + '"><td>' + esc(g.formId) + '</td><td>' + esc(label(c.rec)) + ' <small>' + esc(g.id) + '</small>' +
          (c.deleted ? ' <span class="tag bad">삭제표식</span><br><small>' + esc(whoDeleted(c.rec)) + '</small>' : '') + (c.locked ? ' <span class="tag">잠금</span>' : '') + '</td><td>' + esc(c.source) +
          '</td><td>' + esc(kst(c.updatedAt)) + '</td><td>' + c.photos + '</td><td>' + c.times + '</td><td>' + c.kb + 'KB</td><td>' + acts + '</td></tr>';
      });
    });
    html += '</tbody></table></div></div>';
    document.getElementById('out').innerHTML = html;
  }

  function pick(spec) {
    var p = spec.split(':');
    var g = groupsCache.filter(function (x, i) { return i === Number(p[0]); })[0];
    return {g: g, c: g && g.copies[Number(p[1])]};
  }

  document.addEventListener('click', async function (e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    var dl = t.getAttribute('data-dl'), rs = t.getAttribute('data-restore');
    if (!dl && !rs) return;
    var sel = pick(dl || rs);
    if (!sel.g || !sel.c) return;
    // 복원은 관리자 이상만 한다(작업자는 조회와 JSON 받기만 가능). 로그인 정보가 없으면 제한하지 않는다.
    if (rs) {
      var me = global.DkjAuth && typeof global.DkjAuth.user === 'function' ? global.DkjAuth.user() : null;
      if (me && ['system_admin', 'responsible', 'manager'].indexOf(me.role) < 0) {
        global.alert('기록 복원은 관리자 이상만 할 수 있습니다. 관리자에게 요청하세요.');
        return;
      }
    }
    if (dl) {
      download('복구사본_' + sel.g.formId + '_' + sel.g.id + '.json', JSON.stringify(sel.c.rec, null, 2));
      return;
    }
    var msg = sel.g.deletedNow
      ? '삭제된 기록을 이 사본(수정 ' + kst(sel.c.updatedAt) + ', 사진 ' + sel.c.photos + '장, 시간 ' + sel.c.times + '건)으로 되살립니다.\n되살린 뒤에는 이 사본의 내용이 현재 기록이 됩니다. 계속할까요?'
      : '이 사본(사진 ' + sel.c.photos + '장, 시간 ' + sel.c.times + '건)으로 현재 기록을 덮어씁니다.\n덮어쓰기 전 현재본은 화면에서 JSON으로 받아 두세요. 계속할까요?';
    if (!global.confirm(msg)) return;
    try {
      await global.DkjRecordStore.save(sel.g.formId, sel.c.rec);
      global.alert('복원했습니다. 해당 서식 화면의 불러오기 목록에서 확인하세요.');
      init();
    } catch (err) {
      global.alert('복원하지 못했습니다: ' + (err && err.message || err));
    }
  });

  async function init() {
    try {
      await global.DkjStorage.ready();
      var groups = await readAll();
      render(groups);
    } catch (err) {
      document.getElementById('msg').textContent = '점검 실패: ' + (err && err.message || err);
    }
  }
  init();
})(window);
