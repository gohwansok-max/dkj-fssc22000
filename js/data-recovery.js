/* 기록 복구 점검 — 같은 기록의 사본(IndexedDB · localStorage 이전 시점 백업)을 비교한다.
 * 조회는 읽기 전용이다. 복원은 버튼을 눌렀을 때만, 잠기지 않은 기록에 한해
 * DkjRecordStore.save 를 거쳐(감사이력·잠금 훅 유지) 같은 id 로 덮어쓴다. */
(function (global) {
  var KEY_RE = /^dkj:records:(.+):(list|draft):v1$/;
  var SRC_IDB = 'IndexedDB(현재)';
  var SRC_LS = 'localStorage(이전 시점 백업)';

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

  async function readAll() {
    var keys = Object.create(null);
    (await global.DkjStore.keys()).forEach(function (k) { if (KEY_RE.test(k)) keys[k] = 1; });
    for (var i = 0; i < global.localStorage.length; i++) {
      var k = global.localStorage.key(i);
      if (KEY_RE.test(k)) keys[k] = 1;
    }
    var groups = Object.create(null); // "formId|recordId" -> {formId, id, kind, copies:[]}
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
          var gk = formId + '|' + kind + '|' + id;
          var g = groups[gk] || (groups[gk] = {formId: formId, kind: kind, id: id, copies: []});
          var d = describe(rec, JSON.stringify(rec));
          d.source = pair[0];
          g.copies.push(d);
        });
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
    // 사본이 둘 이상이고 서로 사진·시간 수가 다른 것을 앞에 둔다.
    var rows = groups.filter(function (g) { return g.copies.length > 0; }).map(function (g) {
      var scores = g.copies.map(score);
      g.differs = g.copies.length > 1 && Math.max.apply(null, scores) !== Math.min.apply(null, scores);
      return g;
    }).sort(function (a, b) {
      return (b.differs - a.differs) || String(b.copies[0].updatedAt).localeCompare(String(a.copies[0].updatedAt));
    });
    groupsCache = rows; // 버튼의 data-* 인덱스는 정렬된 이 배열 기준이다.
    var diff = rows.filter(function (g) { return g.differs; }).length;
    document.getElementById('msg').innerHTML = '기록·임시본 ' + rows.length + '건 중 <strong>사본 간 사진·시간 수가 다른 것 ' + diff + '건</strong>' +
      (diff ? ' — 아래 초록색 행이 사진·시간이 가장 많이 남은 사본입니다.' : '. 복원할 차이는 이 기기에서 발견되지 않았습니다.');
    var html = '<div class="card"><div class="wrap"><table><thead><tr><th>서식</th><th>기록</th><th>저장 위치</th><th>수정시각</th><th>사진</th><th>시간 입력</th><th>크기</th><th></th></tr></thead><tbody>';
    rows.forEach(function (g, gi) {
      var best = Math.max.apply(null, g.copies.map(score));
      g.copies.forEach(function (c, ci) {
        var isBest = g.differs && score(c) === best;
        var acts = '<button class="btn" data-dl="' + gi + ':' + ci + '">JSON 받기</button>';
        var idbCopy = g.copies.filter(function (x) { return x.source === SRC_IDB; })[0];
        if (g.kind === 'list' && c.source === SRC_LS && isBest && idbCopy && !idbCopy.locked && !c.deleted) {
          acts += ' <button class="btn primary" data-restore="' + gi + ':' + ci + '">이 사본으로 복원</button>';
        }
        html += '<tr class="' + (isBest ? 'best' : '') + '"><td>' + esc(g.formId) + '</td><td>' + esc(label(c.rec)) + ' <small>' + esc(g.id) + '</small>' +
          (c.deleted ? ' <span class="tag bad">삭제표식</span>' : '') + (c.locked ? ' <span class="tag">잠금</span>' : '') + '</td><td>' + esc(c.source) +
          '</td><td>' + esc(c.updatedAt.slice(0, 19).replace('T', ' ')) + '</td><td>' + c.photos + '</td><td>' + c.times + '</td><td>' + c.kb + 'KB</td><td>' + acts + '</td></tr>';
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
    if (dl) {
      download('복구사본_' + sel.g.formId + '_' + sel.g.id + '.json', JSON.stringify(sel.c.rec, null, 2));
      return;
    }
    if (!global.confirm('이 사본(사진 ' + sel.c.photos + '장, 시간 ' + sel.c.times + '건)으로 현재 기록을 덮어씁니다.\n덮어쓰기 전 현재본은 화면에서 JSON으로 받아 두세요. 계속할까요?')) return;
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
