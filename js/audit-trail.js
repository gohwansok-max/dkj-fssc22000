(function () {
  'use strict';
  var allRecords = [], allEvents = [], view = [], byKey = {};
  function $(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmt(v) { if (!v) return '-'; try { return new Date(v).toLocaleString('ko-KR', { hour12:false }); } catch(e) { return v; } }
  function keyOf(r) { return r.formId + '::' + r.id; }
  function stamp() { var d=new Date(), p=function(n){return String(n).padStart(2,'0');}; return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'_'+p(d.getHours())+p(d.getMinutes()); }
  function isAdmin() { return !window.DkjAuth || !DkjAuth.configured || !DkjAuth.configured() || DkjAuth.isSystemAdmin(); }
  function stateLabel(r) { if (r.locked) return '최종 잠금'; if (r.signs) return '결재 진행'; return '초안'; }
  function integrity(r) { if (!r.auditCount) return 'none'; return r.verify && r.verify.ok ? 'ok' : 'ng'; }
  function statusTag(r) { var s=stateLabel(r); return '<span class="tag '+(r.locked?'lock':r.signs?'sign':'')+'">'+esc(s)+'</span>'; }
  function integrityTag(r) { var v=integrity(r); return v==='ok'?'<span class="tag ok">정상</span>':v==='ng'?'<span class="tag ng">불일치</span>':'<span class="tag">미적용</span>'; }

  function collect() {
    var list = window.DkjExport ? DkjExport.collect() : [];
    allRecords = list.map(function (base) {
      var raw = base.raw || {}, audit = Array.isArray(raw.audit) ? raw.audit : [], verify = window.DkjApproval ? DkjApproval.verify(raw) : {ok:true,total:audit.length};
      var row = { formId:base.formId, formTitle:base.formTitle || '', id:base.id || '', title:base.title || '', date:base.date || '', writer:base.writer || base.createdBy || '', raw:raw, audit:audit, auditCount:audit.length, verify:verify, signs:Object.keys(raw.signoff || {}).length, locked:!!raw.locked, updatedAt:base.updatedAt || raw.updatedAt || '', createdAt:base.createdAt || raw.createdAt || '' };
      byKey[keyOf(row)] = row;
      return row;
    });
    allEvents = [];
    allRecords.forEach(function (record) {
      record.audit.forEach(function (event, index) {
        allEvents.push({ at:event.at || record.updatedAt || record.createdAt, formId:record.formId, formTitle:record.formTitle, recordId:record.id, title:record.title, action:event.action || 'EVENT', actor:event.by || '', detail:event.detail || '', hash:event.hash || '', index:index + 1, record:record });
      });
    });
    allEvents.sort(function(a,b){ return String(b.at||'').localeCompare(String(a.at||'')); });
  }

  function options() {
    var forms={}, actions={}; allRecords.forEach(function(r){ forms[r.formId]=r.formTitle; }); allEvents.forEach(function(e){ actions[e.action]=1; });
    $('form').innerHTML='<option value="">전체 서식 ('+Object.keys(forms).length+'종)</option>'+Object.keys(forms).sort().map(function(k){return '<option value="'+esc(k)+'">'+esc(k+(forms[k]?' · '+forms[k]:''))+'</option>';}).join('');
    $('action').innerHTML='<option value="">전체 행위</option>'+Object.keys(actions).sort().map(function(k){return '<option value="'+esc(k)+'">'+esc(k)+'</option>';}).join('');
  }
  function filters() { return {from:$('from').value,to:$('to').value,form:$('form').value,action:$('action').value,integrity:$('integrity').value,q:$('q').value.trim().toLowerCase()}; }
  function apply() {
    var f=filters(); view=allEvents.filter(function(e){ var day=String(e.at||'').slice(0,10), r=e.record, hay=[e.formId,e.formTitle,e.title,e.action,e.actor,e.detail,r.writer].join(' ').toLowerCase(); if(f.from&&day<f.from)return false;if(f.to&&day>f.to)return false;if(f.form&&e.formId!==f.form)return false;if(f.action&&e.action!==f.action)return false;if(f.integrity&&integrity(r)!==f.integrity)return false;if(f.q&&hay.indexOf(f.q)===-1)return false;return true; }); render(); }
  function renderSummary() { var ok=allRecords.filter(function(r){return integrity(r)==='ok';}).length, ng=allRecords.filter(function(r){return integrity(r)==='ng';}).length, signs=allRecords.reduce(function(n,r){return n+r.signs;},0); $('countRecords').textContent=allRecords.length;$('countEvents').textContent=allEvents.length;$('countSigns').textContent=signs;$('countOk').textContent=ok;$('countNg').textContent=ng;$('summary').innerHTML='<span class="pill">표시 로그 <b>'+view.length+'건</b></span><span class="pill">잠금 기록 <b>'+allRecords.filter(function(r){return r.locked;}).length+'건</b></span><span class="pill">감사이력 미적용 <b>'+allRecords.filter(function(r){return integrity(r)==='none';}).length+'건</b></span><span class="pill">동기화 범위: 현재 기기·클라우드 동기화 완료 기록</span>'; }
  function render() {
    renderSummary(); var body=$('body'); if(!view.length){body.innerHTML='<tr><td colspan="9" class="empty">조건에 맞는 감사 추적 로그가 없습니다.</td></tr>';return;}
    body.innerHTML=view.slice(0,500).map(function(e){var r=e.record;return '<tr><td>'+esc(fmt(e.at))+'</td><td><b>'+esc(e.formId)+'</b><br><span class="code">'+esc((e.title||r.title||r.id).slice(0,72))+'</span></td><td><span class="tag '+(e.action==='SIGN'?'sign':e.action==='LOCK'?'lock':'')+'">'+esc(e.action)+'</span></td><td>'+esc(e.actor||'-')+'</td><td>'+esc(e.detail||'-')+'</td><td>'+statusTag(r)+'</td><td>'+integrityTag(r)+'</td><td class="code">'+esc(String(e.hash||'-').slice(0,12))+'</td><td><button class="btn sub detail-btn" data-key="'+esc(keyOf(r))+'">상세</button></td></tr>';}).join('');
    body.querySelectorAll('.detail-btn').forEach(function(b){b.addEventListener('click',function(){showDetail(b.getAttribute('data-key'));});});
  }
  function showDetail(key) { var r=byKey[key];if(!r)return; var sign=r.raw.signoff||{}, approval=r.raw.approvals||{}, stages=['writer','reviewer','approver'];var cells=stages.map(function(k){var s=sign[k], name=s?(s.empId?s.name+'('+s.empId+')':s.name):(approval[k]||'미지정');return '<div class="detail-cell"><span>'+({writer:'작성',reviewer:'검토',approver:'승인'}[k])+'</span><b>'+esc(name)+'</b><br>'+esc(s&&s.at?fmt(s.at):'결재 대기')+'</div>';}).join('');var v=r.verify||{};$('detail').className='detail show';$('detail').innerHTML='<button class="btn sub" id="closeDetail">닫기</button><h3>'+esc(r.formId+' · '+(r.title||r.id))+'</h3><p class="sub">기록 ID: <code>'+esc(r.id)+'</code> · 무결성: <b>'+esc(v.ok?'정상':'불일치')+'</b>'+(v.ok?'':' · 불일치 위치 '+esc(v.brokenAt))+'</p><div class="detail-grid">'+cells+'</div><h3>원본 감사이력 (읽기 전용)</h3><pre>'+esc(JSON.stringify(r.audit,null,2))+'</pre>';$('closeDetail').addEventListener('click',function(){$('detail').className='detail';}); $('detail').scrollIntoView({behavior:'smooth',block:'nearest'}); }
  function csv() { if(!view.length){alert('내보낼 로그가 없습니다.');return;}var header=['일시','서식코드','기록ID','기록제목','행위','행위자','세부내용','잠금','무결성','해시'];function safe(v){var s=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}var rows=view.map(function(e){var r=e.record;return [e.at,e.formId,e.recordId,e.title,e.action,e.actor,e.detail,r.locked?'잠금':'미잠금',integrity(r),e.hash].map(safe).join(',');});var blob=new Blob(['\ufeff'+header.join(',')+'\r\n'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='DKJ_전자결재_감사추적_'+stamp()+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},500); }
  function access() { var ok=isAdmin(); $('adminApp').classList.toggle('hide',!ok);$('denied').classList.toggle('hide',ok);if(!ok)return;$('accessPill').textContent=(window.DkjAuth&&DkjAuth.user()?'시스템 관리자 · '+DkjAuth.user().name:'로컬 검증 모드');collect();options();apply(); }
  function bind(){['from','to','form','action','integrity'].forEach(function(id){$(id).addEventListener('change',apply);});$('q').addEventListener('input',apply);$('refresh').addEventListener('click',function(){collect();options();apply();});$('csv').addEventListener('click',csv);$('print').addEventListener('click',function(){window.print();});window.addEventListener('dkj:records-changed',function(){if(isAdmin()){collect();options();apply();}});document.addEventListener('dkj:auth-ready',access);}
  function init(){bind();setTimeout(access,250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
