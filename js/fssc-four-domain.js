(function () {
  'use strict';

  var FORM_ID = 'FSSC-AR-HUB';
  var DOMAIN = {
    fraud: { label: '식품사기', forms: ['FR-033', 'FR-034'] },
    defense: { label: '식품방어', forms: ['FR-031', 'FR-032'] },
    env: { label: '환경모니터링', forms: ['FR-037', 'FR-038'] },
    allergen: { label: '알레르기 관리', forms: ['FR-035'] }
  };

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function displayDate(value) {
    if (!value) return '일자 미입력';
    var d = new Date(value.length === 10 ? value + 'T00:00:00' : value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('ko-KR');
  }

  function statusMeta(status) {
    if (status === 'open') return { label: '이탈·시정조치', cls: 'open' };
    if (status === 'review') return { label: '보완·검토', cls: 'review' };
    return { label: '적합·유지', cls: '' };
  }

  function allEvidence() {
    if (!window.DkjRecordStore) return [];
    return window.DkjRecordStore.list(FORM_ID)
      .filter(function (record) { return record && record.recordType === 'fssc_additional_requirement_evidence'; })
      .sort(function (a, b) { return String(b.docDate || b.createdAt || '').localeCompare(String(a.docDate || a.createdAt || '')); });
  }

  function existingCount(domain) {
    if (!window.DkjRecordStore) return 0;
    return DOMAIN[domain].forms.reduce(function (sum, formId) {
      return sum + window.DkjRecordStore.list(formId).length;
    }, 0);
  }

  function domainCount(domain) {
    return existingCount(domain) + allEvidence().filter(function (record) { return record.domain === domain; }).length;
  }

  function refreshSummary() {
    var map = { fraud: 'sumFraud', defense: 'sumDefense', env: 'sumEnv', allergen: 'sumAllergen' };
    Object.keys(map).forEach(function (domain) {
      var el = document.getElementById(map[domain]);
      if (el) el.textContent = String(domainCount(domain));
    });
  }

  function renderEvidence(domain) {
    var mount = document.getElementById('evidence-' + domain);
    if (!mount) return;
    var rows = allEvidence().filter(function (record) { return record.domain === domain; });
    if (!rows.length) {
      mount.innerHTML = '<div class="empty">이 화면에서 등록한 실행·검증 이력이 없습니다. 공식 FR 서식 작성 후 현장 점검·검증 이력을 추가하세요.</div>';
      return;
    }
    mount.innerHTML = '<h3>이 화면의 실행·검증 이력</h3>' + rows.map(function (record) {
      var state = statusMeta(record.status);
      var sub = [record.subject, record.checkType, record.result, record.allergen, record.zone].filter(Boolean).join(' · ');
      var detail = [record.action, record.evidence ? '증빙: ' + record.evidence : ''].filter(Boolean).join(' / ');
      return '<article class="evidence-row">' +
        '<div class="date">' + esc(displayDate(record.docDate || record.createdAt)) + '</div>' +
        '<div><strong>' + esc(sub || '실행·검증 이력') + '</strong><br><span>' + esc(detail || '세부내용 미입력') + '</span></div>' +
        '<span class="status ' + state.cls + '">' + state.label + '</span>' +
        '<span class="date">담당: ' + esc(record.owner || record.createdBy || '미입력') + (record.dueDate ? '<br>검토: ' + esc(displayDate(record.dueDate)) : '') + '</span>' +
      '</article>';
    }).join('');
  }

  function renderTeamSettingsSummary() {
    var mount = document.getElementById('teamSettingsSummary');
    if (!mount || !window.DkjRecordStore) return;
    var records = window.DkjRecordStore.list('HACCP-TEAM-SETTINGS')
      .filter(function (record) { return record && record.locked; })
      .sort(function (a, b) { return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')); });
    if (!records.length) {
      mount.innerHTML = '<strong>승인 기준 미설정</strong> · HACCP팀이 위험등급과 환경 채취지점·주기·판정기준을 검토·승인해야 심사 준비 기준이 확정됩니다. <a href="haccp-team-settings.html" style="color:#fff;font-weight:800;text-decoration:underline">설정·승인하기 →</a>';
      return;
    }
    var setting = records[0];
    mount.innerHTML = '<strong>승인 기준 적용 중</strong> · ' + esc(setting.revision || '개정번호 미입력') + ' / 적용일 ' + esc(displayDate(setting.effectiveDate)) + ' / 환경 채취지점 ' + esc((setting.samplingSites || []).length) + '개 · 승인자 ' + esc((setting.signoff && setting.signoff.approver && setting.signoff.approver.name) || setting.approver || '미입력') + ' <a href="haccp-team-settings.html" style="color:#fff;font-weight:800;text-decoration:underline">개정이력 보기 →</a>';
  }

  function refreshAll() {
    refreshSummary();
    renderTeamSettingsSummary();
    Object.keys(DOMAIN).forEach(renderEvidence);
  }

  function setTab(domain) {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-domain') === domain);
    });
    document.querySelectorAll('.domain').forEach(function (section) {
      section.classList.toggle('active', section.id === 'domain-' + domain);
    });
    var selected = document.getElementById('domain-' + domain);
    if (selected && window.innerWidth < 850) selected.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function prepareForms() {
    var user = window.DkjAuth && window.DkjAuth.user ? window.DkjAuth.user() : null;
    document.querySelectorAll('.domain-form').forEach(function (form) {
      var date = form.querySelector('[name="docDate"]');
      if (!date) {
        date = document.createElement('input');
        date.type = 'hidden'; date.name = 'docDate'; form.appendChild(date);
      }
      date.value = today();
      var owner = form.querySelector('[name="owner"]');
      if (owner && user && !owner.value) owner.value = user.name || user.empId || '';
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var domain = form.getAttribute('data-domain');
        var required = form.querySelectorAll('[required]');
        for (var i = 0; i < required.length; i++) {
          if (!required[i].value.trim()) { required[i].focus(); alert('필수 항목을 입력하세요.'); return; }
        }
        var data = new FormData(form);
        var subject = String(data.get('subject') || '').trim();
        var ownerName = String(data.get('owner') || '').trim();
        var action = String(data.get('action') || '').trim();
        if (!subject || !ownerName || !action) { alert('대상, 담당자, 관리·조치 내용을 모두 입력하세요.'); return; }
        var record = {
          recordType: 'fssc_additional_requirement_evidence',
          domain: domain,
          title: DOMAIN[domain].label + ' 실행·검증 이력 · ' + subject,
          docDate: data.get('docDate') || today(),
          subject: subject,
          risk: data.get('risk') || '',
          checkType: data.get('checkType') || '',
          zone: data.get('zone') || '',
          allergen: data.get('allergen') || '',
          result: data.get('result') || '',
          owner: ownerName,
          action: action,
          status: data.get('status') || 'verified',
          dueDate: data.get('dueDate') || '',
          evidence: data.get('evidence') || '',
          audit: [{ at: new Date().toISOString(), action: 'fssc_additional_requirement_evidence_created', actor: ownerName }]
        };
        window.DkjRecordStore.save(FORM_ID, record);
        form.reset();
        form.querySelector('[name="docDate"]').value = today();
        if (owner && user) owner.value = user.name || user.empId || '';
        refreshAll();
        alert(DOMAIN[domain].label + ' 실행·검증 이력이 저장됐습니다. 이탈·보완 항목은 조치 완료 후 새 검증 이력을 추가하세요.');
      });
    });
  }

  function init() {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () { setTab(tab.getAttribute('data-domain')); });
    });
    prepareForms();
    refreshAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
