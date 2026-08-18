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
  function reportName() { return 'DKJ_공식_감사추적보고서_' + stamp(); }
  function reportCss() { return '@page{size:A4;margin:13mm}*{box-sizing:border-box}body{margin:0;color:#1d4048;background:#fff;font-family:"Noto Sans KR","Malgun Gothic",sans-serif}.official-report{width:100%;font-size:11px}.r-head{padding:0 0 15px;border-bottom:3px solid #0b5c72}.r-kicker{color:#08715f;font-size:10px;font-weight:800;letter-spacing:.12em}.r-head h1{margin:5px 0;font-size:23px;color:#123f4a}.r-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-top:12px;color:#537178;font-size:10px}.r-section{margin-top:17px;break-inside:avoid;page-break-inside:avoid}.r-section h2{margin:0 0 8px;color:#155463;font-size:14px}.r-summary{width:100%;border-collapse:collapse}.r-summary td{width:20%;padding:9px;border:1px solid #d6e6e8;text-align:center}.r-summary b{display:block;color:#0b5c72;font-size:18px}.r-summary span{color:#607a80;font-size:10px}.r-table{width:100%;border-collapse:collapse;font-size:9.5px}.r-table th,.r-table td{padding:6px;border:1px solid #d7e5e7;text-align:left;vertical-align:top}.r-table th{color:#315c65;background:#edf8f9;font-size:9px}.r-foot{margin-top:16px;padding-top:9px;border-top:1px solid #d7e5e7;color:#617d82;font-size:9px;line-height:1.55}.ok{color:#08715f;font-weight:800}.ng{color:#9b302a;font-weight:800}' }
  function officialReportHtml() {
    var f=filters(), seen={}, records=[];
    view.forEach(function(e){var k=keyOf(e.record);if(!seen[k]){seen[k]=1;records.push(e.record);}});
    var signs=view.filter(function(e){return e.action==='SIGN';}).length;
    var locks=view.filter(function(e){return e.action==='LOCK';}).length;
    var ok=records.filter(function(r){return integrity(r)==='ok';}).length;
    var ng=records.filter(function(r){return integrity(r)==='ng';}).length;
    var scope=[f.from||'전체',f.to||'전체',f.form||'전체 서식',f.action||'전체 행위',f.integrity==='ok'?'무결성 정상':f.integrity==='ng'?'검토 필요':'무결성 전체',f.q||'검색어 없음'].join(' · ');
    var td='style="padding:5px;border:1px solid #d7e5e7;vertical-align:top;text-align:left"';
    var th='style="padding:6px;border:1px solid #d7e5e7;background:#edf8f9;color:#315c65;font-size:9px;text-align:left"';
    var rows=view.slice(0,300).map(function(e){
      var r=e.record, state=integrity(r);
      return '<tr><td '+td+'>'+esc(fmt(e.at))+'</td><td '+td+'>'+esc(e.formId)+'</td><td '+td+'>'+esc((e.title||r.title||r.id).slice(0,42))+'</td><td '+td+'>'+esc(e.action)+'</td><td '+td+'>'+esc(e.actor||'-')+'</td><td '+td+'>'+esc(e.detail||'-')+'</td><td '+td+'><span style="font-weight:800;color:'+(state==='ng'?'#9b302a':'#08715f')+'">'+esc(state==='ok'?'정상':state==='ng'?'불일치':'미적용')+'</span></td><td '+td+'>'+esc(String(e.hash||'-').slice(0,12))+'</td></tr>';
    }).join('');
    var user=(window.DkjAuth&&DkjAuth.user&&DkjAuth.user())||{};
    var tile=function(num,label){return '<td style="width:20%;padding:9px;border:1px solid #d6e6e8;text-align:center"><div style="color:#0b5c72;font-size:18px;font-weight:800">'+num+'</div><div style="color:#607a80;font-size:10px">'+label+'</div></td>';};
    return '<div style="width:710px;padding:8px;background:#ffffff;color:#1d4048;font-family:Arial,Malgun Gothic,sans-serif;font-size:11px;line-height:1.45">'
      +'<div style="padding:0 0 15px;border-bottom:3px solid #0b5c72"><div style="color:#08715f;font-size:10px;font-weight:800;letter-spacing:1px">FSSC 22000 · ELECTRONIC APPROVAL / AUDIT TRAIL</div><div style="margin:5px 0;font-size:23px;font-weight:800;color:#123f4a">공식 전자결재·감사 추적 보고서</div><div style="color:#537178;font-size:10px">사업장: 동김제농협 산지유통센터 &nbsp; | &nbsp; 생성일시: '+esc(fmt(new Date().toISOString()))+'<br>생성자: '+esc(user.name||'시스템 관리자')+'<br>조회 조건: '+esc(scope)+'</div></div>'
      +'<div style="margin-top:17px"><div style="margin-bottom:8px;font-size:14px;font-weight:800;color:#155463">1. 감사 추적 요약</div><table style="width:100%;border-collapse:collapse"><tr>'+tile(records.length,'대상 기록')+tile(view.length,'감사 이벤트')+tile(signs,'전자서명')+tile(locks,'잠금 행위')+tile(ok+' / '+ng,'무결성 정상 / 불일치')+'</tr></table></div>'
      +'<div style="margin-top:17px"><div style="margin-bottom:8px;font-size:14px;font-weight:800;color:#155463">2. 심사 제출용 감사 이력</div><table style="width:100%;border-collapse:collapse;font-size:9px"><thead><tr><th '+th+'>일시</th><th '+th+'>서식</th><th '+th+'>기록</th><th '+th+'>행위</th><th '+th+'>행위자</th><th '+th+'>세부내용</th><th '+th+'>무결성</th><th '+th+'>해시</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
      +'<div style="margin-top:16px;padding-top:9px;border-top:1px solid #d7e5e7;color:#617d82;font-size:9px">본 보고서는 관리자 화면에서 선택한 조건의 전자결재·감사 추적 로그를 읽기 전용으로 출력한 문서입니다. 무결성 불일치 기록은 심사 제출 전 원본 기록과 동기화 상태를 확인해야 합니다.'+(view.length>300?' 로그 300건 초과분은 CSV 내보내기로 확인하세요.':'')+'</div></div>';
  }
  function printReport(savePdf) { if(!view.length){alert('출력할 감사 로그가 없습니다.');return;} var report=officialReportHtml(), title=savePdf?'공식 감사 추적 보고서 · PDF로 저장':'공식 감사 추적 보고서', win=window.open('','_blank','width=900,height=900'); if(!win){alert('인쇄 창을 열 수 없습니다. 브라우저 팝업 차단을 해제한 뒤 다시 시도하세요.');return;} win.document.open();win.document.write('<!doctype html><html lang="ko"><head><meta charset="UTF-8"><title>'+title+'</title><style>'+reportCss()+'</style></head><body>'+report+'</body></html>');win.document.close();try{win.opener=null;}catch(e){}setTimeout(function(){win.focus();win.print();},450); }
  function savePdf() { printReport(true); }
  function access() { var ok=isAdmin(); $('adminApp').classList.toggle('hide',!ok);$('denied').classList.toggle('hide',ok);if(!ok)return;$('accessPill').textContent=(window.DkjAuth&&DkjAuth.user()?'시스템 관리자 · '+DkjAuth.user().name:'로컬 검증 모드');collect();options();apply(); }
  function bind(){['from','to','form','action','integrity'].forEach(function(id){$(id).addEventListener('change',apply);});$('q').addEventListener('input',apply);$('refresh').addEventListener('click',function(){collect();options();apply();});$('csv').addEventListener('click',csv);$('pdf').addEventListener('click',savePdf);$('print').addEventListener('click',printReport);window.addEventListener('dkj:records-changed',function(){if(isAdmin()){collect();options();apply();}});document.addEventListener('dkj:auth-ready',access);}
  function init(){bind();setTimeout(access,250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
