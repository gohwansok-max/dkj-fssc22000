(function(){
  'use strict';
  var $=function(id){return document.getElementById(id);};
  var FORMS={capa:'CAPA-MANAGEMENT',periodic:'PERIODIC-ALERTS',drill:'EMERGENCY-DRILL',mock:'TRACE-DRILL',recall:'FR-016',trace:'FR-040',audit:'AUDIT-TRAIL'};
  function list(id){try{return(window.DkjRecordStore&&DkjRecordStore.list(id))||[];}catch(e){return[];}}
  function n(v){var x=Number(v);return isFinite(x)?x:0;}
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function today(){var d=new Date();d.setHours(0,0,0,0);return d;}
  function parseDate(v){if(!v)return null;var d=/^\d{4}-\d{2}-\d{2}$/.test(String(v))?new Date(String(v)+'T00:00:00'):new Date(v);return isNaN(d.getTime())?null:d;}
  function dayDiff(v){var d=parseDate(v);return d?Math.round((d.getTime()-today().getTime())/86400000):null;}
  function dateLabel(v){var d=parseDate(v);return d?d.toLocaleDateString('ko-KR',{month:'2-digit',day:'2-digit'}):'-';}
  function recordDate(r){return parseDate(r.updatedAt||r.lockedAt||r.approvedAt||r.closureDate||r.finishedAt||r.drillDate||r.createdAt)||new Date(0);}
  function link(type,r){var id=encodeURIComponent(r.id||'');if(type==='capa')return 'capa-management.html?record='+id;if(type==='periodic')return 'periodic-alerts.html';if(type==='drill')return 'emergency-drills.html?record='+id;if(type==='mock')return 'traceability.html?record='+id;if(type==='recall')return 'records/FR-016.html?record='+id;if(type==='trace')return 'records/FR-040.html?record='+id;return 'audit-trail.html';}
  function periodicStatus(r){if(r.active===false)return 'inactive';if(!r.dueDate)return 'missing';var d=dayDiff(r.dueDate),lead=Math.max(0,n(r.leadDays||7));if(d<0)return 'overdue';if(d===0)return 'today';if(d<=lead)return 'soon';return 'scheduled';}
  function capaLabel(r){return r.capaNo||r.item||r.subject||'CAPA 기록';}
  function drillLabel(r){return r.scenarioTitle||r.scenario||r.subject||'모의훈련 기록';}
  function documentSummary(){
    var c=(window.DKJ_DOC_CATALOG&&DKJ_DOC_CATALOG.categories)||[];
    var total=c.reduce(function(sum,x){return sum+n(x.count);},0);
    var incomplete=c.filter(function(x){return x.workflowStatus&&x.workflowStatus!=='완료';});
    return {categories:c.length,total:total,incomplete:incomplete.length};
  }
  function allData(){
    var capa=list(FORMS.capa),periodic=list(FORMS.periodic),drill=list(FORMS.drill),mock=list(FORMS.mock),recall=list(FORMS.recall),trace=list(FORMS.trace),docs=documentSummary();
    var open=capa.filter(function(r){return !r.locked;});
    var capaOverdue=open.filter(function(r){var d=dayDiff(r.dueDate);return d!==null&&d<0;});
    var active=periodic.filter(function(r){return r.active!==false;});
    var p={overdue:active.filter(function(r){return periodicStatus(r)==='overdue';}),today:active.filter(function(r){return periodicStatus(r)==='today';}),soon:active.filter(function(r){return periodicStatus(r)==='soon';}),missing:active.filter(function(r){return periodicStatus(r)==='missing';})};
    var locked=capa.filter(function(r){return r.locked;}).length+drill.filter(function(r){return r.locked;}).length+mock.filter(function(r){return r.locked;}).length+recall.filter(function(r){return r.locked||r.result&&r.result.approver;}).length+trace.filter(function(r){return r.locked;}).length;
    var traceDone=mock.filter(function(r){return r.locked;}).length+trace.filter(function(r){return r.locked;}).length+recall.filter(function(r){return r.locked||r.result&&r.result.approver;}).length;
    var all=[];[[capa,'capa'],[periodic,'periodic'],[drill,'drill'],[mock,'mock'],[recall,'recall'],[trace,'trace']].forEach(function(pair){pair[0].forEach(function(r){all.push({type:pair[1],record:r});});});
    return {capa:capa,open:open,capaOverdue:capaOverdue,periodic:periodic,active:active,p:p,drill:drill,mock:mock,recall:recall,trace:trace,locked:locked,traceDone:traceDone,docs:docs,all:all};
  }
  function addSummary(root,level,num,title,text,href){var d=document.createElement('div');d.className='ex-summary-line '+(level||'');d.innerHTML='<i>'+num+'</i><div><b>'+esc(title)+'</b><br><span>'+esc(text)+'</span></div><a href="'+esc(href)+'">확인하기</a>';root.appendChild(d);}
  function render(){
    var x=allData(),critical=x.capaOverdue.length+x.p.overdue.length+x.p.missing.length,soon=x.p.soon.length+x.p.today.length;
    $('exCritical').textContent=critical;$('exSoon').textContent=soon;$('exOpenCapa').textContent=x.open.length;$('exLocked').textContent=x.locked;$('exTraceDone').textContent=x.traceDone;
    var total=x.all.length,synced=!!(window.DkjCloudSync&&DkjCloudSync.enabled&&DkjCloudSync.enabled());
    $('exDataInfo').textContent='전자기록 '+total+'건 · '+(synced?'클라우드 동기화':'현재 기기 기록')+' · '+new Date().toLocaleString('ko-KR')+' 갱신';
    var summary=$('exSummary');summary.innerHTML='';
    addSummary(summary,critical?'danger':'',1,'품질 위험',critical?'즉시 확인 '+critical+'건: CAPA 기한초과·정기관리 예정일 미등록을 먼저 확인하세요.':'현재 기록에서 기한초과 CAPA와 예정일 미등록 정기관리 항목이 없습니다.','quality-dashboard.html');
    addSummary(summary,soon?'warn':'',2,'정기 관리',soon?'오늘·7일 이내 예정 '+soon+'건입니다. 담당자와 실시·완료 기록을 확인하세요.':'오늘·7일 이내 정기 관리 경보가 없습니다.','periodic-alerts.html');
    addSummary(summary,x.open.length?'warn':'',3,'시정조치',x.open.length?'미종결 CAPA '+x.open.length+'건입니다. 원인분석·효과검증·결재 상태를 확인하세요.':'미종결 CAPA 기록이 없습니다.','capa-management.html');
    addSummary(summary,x.drill.filter(function(r){return !r.locked;}).length?'warn':'',4,'비상·식품방어',x.drill.length?'모의훈련 '+x.drill.length+'건 중 결재·잠금 '+x.drill.filter(function(r){return r.locked;}).length+'건입니다.':'저장된 비상·식품방어 모의훈련 기록이 없습니다.','emergency-drills.html');
    addSummary(summary,x.docs.incomplete?'warn':'',5,'문서·심사준비',x.docs.total?'관리 문서 '+x.docs.total+'건, 완료 외 상태 카테고리 '+x.docs.incomplete+'건입니다.':'문서 카탈로그 상태를 불러오지 못했습니다.','docs-center.html');
    addSummary(summary,'',6,'추적성·감사이력','추적성·모의회수·회수 종결 '+x.traceDone+'건, 결재·잠금 증빙 '+x.locked+'건입니다.','audit-trail.html');
    var bars=[['문서·심사준비 완료',x.docs.categories-x.docs.incomplete,x.docs.categories,'docs-center.html',x.docs.incomplete?'warn':''],['정기 관리 완료·관리중',x.active.length,x.periodic.length,'periodic-alerts.html',''],['CAPA 종결·잠금',x.capa.filter(function(r){return r.locked;}).length,x.capa.length,'capa-management.html',x.open.length?'warn':''],['비상·식품방어 훈련 잠금',x.drill.filter(function(r){return r.locked;}).length,x.drill.length,'emergency-drills.html',x.drill.some(function(r){return !r.locked;})?'warn':''],['추적성·모의회수 종결',x.traceDone,x.mock.length+x.trace.length+x.recall.length,'traceability.html',''],['결재·잠금 증빙',x.locked,total,'audit-trail.html','']];
    $('exBars').innerHTML=bars.map(function(b){var p=b[2]?Math.round(b[1]/b[2]*100):0;return '<a class="ex-bar-row ex-link" href="'+b[3]+'"><span>'+esc(b[0])+'</span><span class="ex-bar"><i class="'+b[4]+'" style="width:'+p+'%"></i></span><span class="ex-bar-val">'+b[1]+' / '+b[2]+'</span></a>';}).join('');
    var risks=[];
    x.capaOverdue.forEach(function(r){risks.push(['긴급','CAPA','기한 '+(r.dueDate||'-')+' · '+capaLabel(r),'capa',r]);});
    x.p.overdue.forEach(function(r){risks.push(['긴급','정기 관리',r.name+' · '+Math.abs(dayDiff(r.dueDate))+'일 지남','periodic',r]);});
    x.p.missing.forEach(function(r){risks.push(['주의','정기 관리',r.name+' · 다음 예정일 미등록','periodic',r]);});
    x.open.filter(function(r){return x.capaOverdue.indexOf(r)<0;}).forEach(function(r){risks.push(['주의','CAPA',capaLabel(r)+' · '+(r.status||'진행 중'),'capa',r]);});
    x.drill.filter(function(r){return !r.locked;}).forEach(function(r){risks.push(['주의','모의훈련',drillLabel(r)+' · 결재·잠금 전','drill',r]);});
    var riskRoot=$('exRiskRows');riskRoot.innerHTML=risks.length?risks.slice(0,12).map(function(row){var c=row[0]==='긴급'?'danger':'warn';return '<tr><td><span class="ex-badge '+c+'">'+row[0]+'</span></td><td>'+esc(row[1])+'</td><td>'+esc(row[2])+'</td><td><a class="ex-link" href="'+link(row[3],row[4])+'">열기</a></td></tr>';}).join(''):'<tr><td colspan="4"><div class="ex-empty">현재 저장된 기록에서 즉시 확인할 기한·상태 경보가 없습니다.</div></td></tr>';
    var recent=x.all.sort(function(a,b){return recordDate(b.record)-recordDate(a.record);}).slice(0,8);$('exRecent').innerHTML=recent.length?recent.map(function(item){var r=item.record,title=item.type==='capa'?capaLabel(r):(item.type==='drill'?drillLabel(r):(r.name||r.targetLot||r.lot||r.subject||'기록'));var status=r.locked?'승인·잠금':(r.status||r.result||'저장');return '<div class="ex-record"><time>'+dateLabel(recordDate(r))+'</time><div><b>'+esc(title)+'</b><small>'+esc(item.type+' · '+status)+'</small></div><a href="'+link(item.type,r)+'">상세</a></div>';}).join(''):'<div class="ex-empty">표시할 최근 전자기록이 없습니다.</div>';
    var review=[['문서·심사준비','문서 '+x.docs.total+'건 · 완료 외 상태 카테고리 '+x.docs.incomplete+'건','MDR·정본·개정·배포 상태 확인'],['CAPA','미종결 '+x.open.length+'건 · 기한초과 '+x.capaOverdue.length+'건','기한·책임자·효과검증·최종결재 확인'],['정기 관리','기한경과 '+x.p.overdue.length+'건 · 예정일 미등록 '+x.p.missing.length+'건','예정일 등록 및 완료기록 확인'],['비상·식품방어','훈련 '+x.drill.length+'건 · 잠금 '+x.drill.filter(function(r){return r.locked;}).length+'건','최근 훈련·개선조치·결재 증빙 확인'],['추적성·회수','종결 '+x.traceDone+'건','LOT·수량대조·연락·CAPA 연계 확인'],['전자결재','잠금 증빙 '+x.locked+'건','감사이력 무결성·권한·승인순서 확인']];
    $('exReviewRows').innerHTML=review.map(function(r){return '<tr><td><b>'+esc(r[0])+'</b></td><td>'+esc(r[1])+'</td><td>'+esc(r[2])+'</td></tr>';}).join('');
  }
  function init(){ $('exRefresh').addEventListener('click',render);document.addEventListener('dkj:cloud-ready',render);document.addEventListener('dkj:records-changed',render);window.addEventListener('dkj:records-changed',render);window.addEventListener('storage',function(e){if(String(e.key||'').indexOf('dkj:records:')===0)render();});render(); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
