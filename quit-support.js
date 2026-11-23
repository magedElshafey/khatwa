/* Khatwa quitting companion — automatic clock, personal motivations and supportive slip logging. */
(function(){
 'use strict';
 let reasonsEditing=false,reasonEditingIndex=null,reasonDeleteIndex=null,dialog='',previousFocus=null,started=false;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const names=()=>Array.isArray(state.settings.quitReasons)?state.settings.quitReasons.filter(x=>typeof x==='string'&&x.trim()).slice(0,12):[];
 const nowLocal=()=>{
  const d=new Date(),p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
 };
 const localDate=value=>String(value||'').slice(0,10);
 function elapsed(value,at=Date.now()){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return {valid:false,days:0,hours:0,minutes:0,future:false};
  const start=new Date(value).getTime();
  if(!Number.isFinite(start))return {valid:false,days:0,hours:0,minutes:0,future:false};
  const diff=Number(at)-start;
  if(diff<0)return {valid:true,future:true,days:0,hours:0,minutes:0};
  const total=Math.floor(diff/60000);
  return {valid:true,future:false,days:Math.floor(total/1440),hours:Math.floor(total%1440/60),minutes:total%60};
 }
 function clock(quitAt){
  const p=elapsed(quitAt);
  const values=p.valid&&!p.future?[p.days,p.hours,p.minutes]:['—','—','—'];
  return `<div class="card quit-clock-card" data-quit-clock="${esc(quitAt||'')}" aria-label="المدة منذ آخر بداية مسجلة للإقلاع">
   <div class="quit-clock-header"><div><span class="quit-clock-eyebrow">رحلتك بتتحسب تلقائيًا</span><h3>الوقت من بداية الإقلاع</h3></div><span class="quit-clock-live">↻ تلقائي</span></div>
   <div class="quit-clock-values">
    <div><strong data-quit-clock-days>${values[0]}</strong><span>يوم</span></div>
    <div><strong data-quit-clock-hours>${values[1]}</strong><span>ساعة</span></div>
    <div><strong data-quit-clock-minutes>${values[2]}</strong><span>دقيقة</span></div>
   </div>
   <p class="quit-clock-note">${!p.valid?'حدّد تاريخ وساعة بداية الإقلاع من تعديل الحساب.':p.future?'وقت البداية اللي اخترته لسه ماجاش.':'العداد مبني على وقت البداية اللي سجلته، من غير ما تحتاج تضغط «تسجيل اليوم». هو تقدير زمني مش تأكيد تلقائي للامتناع.'}</p>
  </div>`;
 }
 function refresh(){
  if(typeof document==='undefined'||document.hidden)return;
  for(const element of document.querySelectorAll('[data-quit-clock]')){
   const p=elapsed(element.getAttribute('data-quit-clock'));
   const vals=p.valid&&!p.future?[p.days,p.hours,p.minutes]:['—','—','—'];
   ['days','hours','minutes'].forEach((field,i)=>{const node=element.querySelector('[data-quit-clock-'+field+']');if(node)node.textContent=String(vals[i]);});
  }
 }
 function start(){
  if(started||typeof document==='undefined')return;
  started=true;setInterval(refresh,10000);
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener('focus',refresh);
  window.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog){close();}});
 }
 function reasonsCard(){
  const reasons=names(),total=reasons.length,featured=reasons[0];
  const tools=(i)=>`<div class="quit-reason-tools">
   <button type="button" class="quit-reason-icon-btn" data-action="quit-reason-up" data-index="${i}" ${i===0?'disabled':''} aria-label="تحريك السبب لأعلى" title="تحريك لأعلى">↑</button>
   <button type="button" class="quit-reason-icon-btn" data-action="quit-reason-down" data-index="${i}" ${i===total-1?'disabled':''} aria-label="تحريك السبب لأسفل" title="تحريك لأسفل">↓</button>
   <button type="button" class="quit-reason-tool-btn" data-action="quit-reason-open-edit" data-index="${i}" aria-label="تعديل السبب رقم ${i+1}">تعديل</button>
   <button type="button" class="quit-reason-tool-btn quit-reason-tool-danger" data-action="quit-reason-delete" data-index="${i}" aria-label="حذف السبب رقم ${i+1}">حذف</button>
  </div>`;
  const rows=reasons.map((reason,i)=>`<div class="quit-reason-manage-row">
    <span class="quit-reason-num">${String(i+1).padStart(2,'0')}</span>
    <div class="quit-reason-manage-body">
     ${reasonEditingIndex===i?`<form data-form="quit-reason-edit" data-index="${i}" class="quit-reason-edit-form"><label for="quit-reason-edit-${i}">تعديل السبب</label><div class="quit-reason-edit-controls"><input id="quit-reason-edit-${i}" type="text" name="reason" maxlength="160" value="${esc(reason)}" required><button type="submit" class="btn primary sm">حفظ</button><button type="button" class="btn sm" data-action="quit-reason-cancel-edit">إلغاء</button></div></form>`:`<span class="quit-reason-manage-text">${esc(reason)}</span>${tools(i)}`}
     ${reasonDeleteIndex===i&&reasonEditingIndex!==i?`<div class="quit-reason-delete-check" role="group" aria-label="تأكيد حذف السبب"><span>تحذف السبب ده؟</span><button type="button" class="btn sm warn" data-action="quit-reason-delete-confirm" data-index="${i}">تأكيد الحذف</button><button type="button" class="btn sm" data-action="quit-reason-cancel-delete">إلغاء</button></div>`:''}
    </div>
   </div>`).join('');
  return `<section class="quit-reasons-pin" aria-label="أهم سبب شخصي للإقلاع">
    <div class="quit-reasons-lead">
      <span class="quit-reasons-symbol" aria-hidden="true">✳</span>
      <div class="quit-reasons-highlight">
        <span class="quit-reasons-kicker">افتكر أنت بدأت ليه</span>
        <strong class="quit-reasons-featured">${featured?esc(featured):'إيه أكتر سبب يخليك تكمل؟'}</strong>
        <span class="quit-reasons-count">${total?`السبب الأول من ${total} ${total===1?'سبب محفوظ':'أسباب محفوظة'}`:'السبب اللي تكتبه الأول هيفضل ظاهر قدامك هنا'}</span>
      </div>
    </div>
    <button type="button" class="quit-reasons-manage-toggle" data-action="quit-edit-reasons" aria-expanded="${reasonsEditing}" aria-controls="quit-reasons-content">${reasonsEditing?'تم':'إدارة الأسباب'}</button>
  </section>
  <section class="quit-reasons-overview" id="quit-reasons-content" aria-label="أسبابك الشخصية للإقلاع">
    ${reasonsEditing?`<div class="quit-reasons-manager">
       <div class="quit-reasons-section-head"><div><h3>رتّب وعدّل أسبابك</h3><p>السبب الأول هو اللي هيفضل قدامك أثناء التمرير. كل تعديل بيتحفظ تلقائيًا.</p></div><span class="quit-reasons-counter">${total} / 12</span></div>
       ${rows||'<p class="quit-reasons-empty">ضيف أول سبب ليك من الخانة اللي تحت.</p>'}
    </div>`:total>0?`<div class="quit-reasons-section-head"><div><h3>كل أسبابك</h3><p>السبب الأول ظاهر فوق للتذكير، وهنا تقدر تقرأ الأسباب كلها من غير اختصار.</p></div><span class="quit-reasons-counter">${total} أسباب</span></div>
      <ul class="quit-reasons-grid">${reasons.map((reason,i)=>`<li class="quit-reason-tile ${i===0?'is-primary':''}"><span class="quit-reason-tile-number">${String(i+1).padStart(2,'0')}</span><span class="quit-reason-tile-text">${esc(reason)}</span>${i===0?'<span class="quit-reason-primary-label">الأهم</span>':''}</li>`).join('')}</ul>`:total===0?'<p class="quit-reasons-empty">اكتب الأسباب اللي بتفرق معاك أنت. مفيش إجابة صح أو غلط.</p>':''}
    <form data-form="quit-reason-add" class="quit-reason-compose">
      <div class="quit-reason-compose-copy"><label for="quit-reason-new">${total?'ضيف سبب جديد':'ضيف أسبابك'}</label><span>اكتب سبب واحد في كل مرة، وتقدر تعدله أو ترتبه بعد كده.</span></div>
      <div class="quit-reason-compose-fields"><input id="quit-reason-new" type="text" name="reason" maxlength="160" placeholder="إيه اللي بيشجعك تكمل؟" autocomplete="off" ${total>=12?'disabled':''} required><button type="submit" class="btn primary" ${total>=12?'disabled':''}>+ إضافة</button></div>
      <small>${total>=12?'وصلت للحد الأقصى (12 سبب). تقدر تعدّل أو تحذف سبب من إدارة الأسباب.':`${total} من 12 سبب محفوظ`}</small>
    </form>
  </section>`;
 }
 function slipHistory(){
  const slips=group('smoking-relapse').slice().sort((a,b)=>String(b.data?.smokedAt||'').localeCompare(String(a.data?.smokedAt||'')));
  return `<section class="quit-history">
   <div class="sectiontitle"><h2>التسجيلات السابقة</h2></div>
   <div class="card"><p class="muted">${slips.length?'عدد المرات اللي اخترت تسجيلها: '+slips.length+' — ده سجل للمتابعة، مش تقييم لشخصك.':'لسه ما سجلتش أي سيجارة بعد بداية الإقلاع.'}</p>
   ${slips.length?`<div class="quit-slip-list">${slips.slice(0,10).map(item=>`<div class="quit-slip-item"><div><strong>${esc(String(item.data.count))} سيجارة مسجلة</strong><span>${esc(new Date(item.data.smokedAt).toLocaleString('ar-EG',{dateStyle:'medium',timeStyle:'short'}))}</span></div>${item.data.note?`<p>${esc(item.data.note)}</p>`:''}</div>`).join('')}</div>`:''}</div>
  </section>`;
 }
 function reminderActions(){
  return `<section class="quit-encouragement"><div class="quit-encouragement-top"><div><span class="quit-reasons-kicker">لما الرغبة تزيد</span><h2>مش لازم تتصرف على الرغبة فورًا</h2><p>الرغبة ممكن تقل لو غيّرت المكان أو أخّرت القرار شوية. اختار خطوة صغيرة تساعدك تعدّي اللحظة.</p></div><button class="btn primary" data-action="quit-urge" type="button">ساعدني أعدّي الرغبة</button></div><div class="quit-relapse-secondary"><span>ولو دخّنت بالفعل، تقدر تسجّل اللي حصل بصدق وتبدأ من جديد.</span><button class="btn sm" data-action="quit-record-open" type="button">تسجيل سيجارة بعد الإقلاع</button></div></section>`;
 }
 function modal(){
  if(!dialog)return '';
  const reasons=names(),list=reasons.length?`<ul class="quit-dialog-reasons">${reasons.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`:'<p class="muted">أسبابك الشخصية لسه مش مكتوبة. تقدر تضيفها من الصفحة الرئيسية.</p>';
  if(dialog==='urge'){
   return `<div class="quit-dialog-overlay"><section class="quit-dialog" role="dialog" aria-modal="true" aria-labelledby="quit-dialog-title" tabindex="-1">
    <button class="quit-dialog-close" type="button" data-action="quit-close" aria-label="إغلاق">×</button><span class="quit-dialog-eyebrow">قبل أي قرار</span><h2 id="quit-dialog-title">دي رغبة مؤقتة، مش أمر لازم تنفذه</h2>
    <p>افتكر أسبابك، واختار حاجة واحدة تعملها دلوقتي:</p>${list}
    <ol class="quit-coping-list"><li>ابعد شوية عن الموقف أو المكان اللي حفّز الرغبة.</li><li>اشرب مياه أو امشِ دقايق بسيطة لو ده مناسب ليك.</li><li>خد أنفاس هادية، أو كلم حد بترتاح في الكلام معاه.</li><li>أجّل قرار التدخين خمس دقايق، وراجع إحساسك بعدها.</li></ol>
    <div class="quit-dialog-actions"><button class="btn primary" data-action="quit-urge-passed" type="button">لسه مدخنتش، هكمل</button><button class="btn" data-action="quit-actually-smoked" type="button">أنا دخّنت بالفعل</button></div>
    <p class="hint">مجرد التفكير أو الرغبة في التدخين مش انتكاسة. ومش هنضيف أي تسجيل إلا لو أكدت إنك دخّنت.</p>
   </section></div>`;
  }
  return `<div class="quit-dialog-overlay"><section class="quit-dialog" role="dialog" aria-modal="true" aria-labelledby="quit-dialog-title" tabindex="-1">
   <button class="quit-dialog-close" type="button" data-action="quit-close" aria-label="إغلاق">×</button><span class="quit-dialog-eyebrow">تسجيل حدث حصل فعلًا</span><h2 id="quit-dialog-title">نقدر نسجّل اللي حصل ونكمل</h2>
   <p>سيجارة واحدة مش بتمسح المجهود اللي فات. التسجيل هيحفظ المحاولة السابقة ويبدأ عداد جديد من الوقت اللي تحدده.</p>${list}
   <form data-form="quit-relapse" class="quit-relapse-form">
     <div class="field"><label for="quit-slip-count">عدد السجاير اللي دخّنتها فعلًا</label><input type="number" id="quit-slip-count" name="count" value="1" min="1" max="100" step="1" required></div>
     <div class="field"><label for="quit-slip-at">وقت آخر سيجارة</label><input type="datetime-local" id="quit-slip-at" name="smokedAt" value="${nowLocal()}" required></div>
     <div class="field"><label for="quit-restart-at">بداية محاولة الإقلاع الجديدة</label><input type="datetime-local" id="quit-restart-at" name="newStart" value="${nowLocal()}" required><small>العداد الجديد هيبدأ من الوقت ده، بعد آخر سيجارة.</small></div>
     <div class="field"><label for="quit-slip-note">إيه اللي حفّزك؟ (اختياري)</label><textarea id="quit-slip-note" name="note" rows="2" maxlength="300" placeholder="تعب، ضغط، موقف اجتماعي…"></textarea></div>
     <label class="quit-confirm"><input type="checkbox" name="confirmed" value="yes" required><span>أنا دخّنت بالفعل، وفاهم إن تسجيل الحدث هيبدأ عدادًا جديدًا مع الاحتفاظ بسجل محاولتي السابقة.</span></label>
     <div class="quit-dialog-actions"><button type="button" class="btn" data-action="quit-back">رجوع</button><button type="submit" class="btn primary">تسجيل اللي حصل وبداية جديدة</button></div>
   </form></section></div>`;
 }
 function focusDialog(){if(typeof document==='undefined')return;setTimeout(()=>{document.querySelector('.quit-dialog [data-action="quit-close"]')?.focus()},0);}
 function open(stage){previousFocus=typeof document==='undefined'?null:document.activeElement;dialog=stage;render();focusDialog();}
 function close(){dialog='';render();if(previousFocus?.isConnected)previousFocus.focus?.();previousFocus=null;}
 async function action(a,element){
  if(a==='quit-edit-reasons'){reasonsEditing=!reasonsEditing;reasonEditingIndex=null;reasonDeleteIndex=null;render();return true;}
  if(a==='quit-reason-cancel-edit'){reasonEditingIndex=null;render();return true;}
  if(a==='quit-reason-cancel-delete'){reasonDeleteIndex=null;render();return true;}
  if(a==='quit-reason-open-edit'){const i=Number(element?.dataset?.index);if(!Number.isInteger(i)||i<0||i>=names().length)return true;reasonEditingIndex=i;reasonDeleteIndex=null;render();return true;}
  if(a==='quit-reason-delete'){const i=Number(element?.dataset?.index);if(!Number.isInteger(i)||i<0||i>=names().length)return true;reasonDeleteIndex=i;reasonEditingIndex=null;render();return true;}
  if(a==='quit-reason-delete-confirm'){
   const i=Number(element?.dataset?.index),items=names();
   if(!Number.isInteger(i)||i!==reasonDeleteIndex||!items[i])return true;
   items.splice(i,1);
   await saveSettings({...state.settings,quitReasons:items});
   reasonDeleteIndex=null;reasonEditingIndex=null;render();window.KhatwaToast.success('السبب اتحذف من قائمتك.');return true;
  }
  if(a==='quit-reason-up'||a==='quit-reason-down'){
   const i=Number(element?.dataset?.index),items=names(),j=i+(a==='quit-reason-up'?-1:1);
   if(!Number.isInteger(i)||i<0||i>=items.length||j<0||j>=items.length)return true;
   [items[i],items[j]]=[items[j],items[i]];
   await saveSettings({...state.settings,quitReasons:items});
   reasonEditingIndex=null;reasonDeleteIndex=null;render();window.KhatwaToast.success('ترتيب الأسباب اتحفظ.');return true;
  }
  if(a==='quit-urge'||a==='quit-record-open'){open('urge');return true;}
  if(a==='quit-actually-smoked'){dialog='record';render();focusDialog();return true;}
  if(a==='quit-back'){dialog='urge';render();focusDialog();return true;}
  if(a==='quit-urge-passed'){close();window.KhatwaToast.success('اختيارك إنك تكمل من غير تدخين خطوة مهمة. خليك مع نفسك بهدوء.');return true;}
  if(a==='quit-close'){close();return true;}
  return false;
 }
 async function submit(form){
  if(form.dataset.form==='quit-reason-add'){
   const reason=String(new FormData(form).get('reason')||'').trim();
   const items=names();
   if(!reason||reason.length>160)throw Error('اكتب سبب واضح لا يزيد عن 160 حرفًا.');
   if(items.length>=12)throw Error('تقدر تحتفظ بحد أقصى 12 سبب.');
   if(items.some(item=>item.toLocaleLowerCase('ar')===reason.toLocaleLowerCase('ar')))throw Error('السبب ده موجود بالفعل.');
   await saveSettings({...state.settings,quitReasons:[...items,reason]});
   reasonEditingIndex=null;reasonDeleteIndex=null;render();window.KhatwaToast.success('سببك الجديد اتحفظ.');return true;
  }
  if(form.dataset.form==='quit-reason-edit'){
   const i=Number(form.dataset.index),items=names(),reason=String(new FormData(form).get('reason')||'').trim();
   if(!Number.isInteger(i)||i<0||i>=items.length)throw Error('السبب اللي بتعدّله مش موجود.');
   if(!reason||reason.length>160)throw Error('اكتب سبب واضح لا يزيد عن 160 حرفًا.');
   if(items.some((item,j)=>i!==j&&item.toLocaleLowerCase('ar')===reason.toLocaleLowerCase('ar')))throw Error('السبب ده موجود بالفعل.');
   items[i]=reason;
   await saveSettings({...state.settings,quitReasons:items});
   reasonEditingIndex=null;reasonDeleteIndex=null;render();window.KhatwaToast.success('تعديل السبب اتحفظ.');return true;
  }
  if(form.dataset.form==='quit-reasons'){
   const raw=String(new FormData(form).get('reasons')||'');
   const lines=[...new Set(raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
   if(lines.length>12||lines.some(x=>x.length>160))throw Error('حد أقصى 12 سبب، وكل سبب لا يزيد عن 160 حرفًا.');
   await saveSettings({...state.settings,quitReasons:lines});reasonsEditing=false;
   render();window.KhatwaToast.success('أسبابك اتحفظت وهتفضل ظاهرة في صفحة الإقلاع.');return true;
  }
  if(form.dataset.form!=='quit-relapse')return false;
  const fd=new FormData(form),count=Number(fd.get('count'));
  const smokedAt=String(fd.get('smokedAt')||''),newStart=String(fd.get('newStart')||'');
  const validDate=x=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x)&&Number.isFinite(new Date(x).getTime());
  if(fd.get('confirmed')!=='yes')throw Error('أكد إن التسجيل لحدث حصل بالفعل.');
  if(!Number.isSafeInteger(count)||count<1||count>100)throw Error('اكتب عدد سجاير صحيح.');
  if(!validDate(smokedAt)||!validDate(newStart))throw Error('راجع تاريخ ووقت السيجارة والبداية الجديدة.');
  const smokedMs=new Date(smokedAt).getTime(),startMs=new Date(newStart).getTime(),now=Date.now();
  if(smokedMs>now+60000||startMs>now+60000||startMs<smokedMs)throw Error('بداية المحاولة الجديدة لازم تكون بعد آخر سيجارة، ومش في المستقبل.');
  const oldCfg=state.settings.smoking;
  if(!oldCfg?.quitAt)throw Error('حدّد وقت بداية الإقلاع من إعدادات المتابعة الأول.');
  if(smokedMs<new Date(oldCfg.quitAt).getTime())throw Error('وقت آخر سيجارة أقدم من وقت بداية المحاولة المسجلة. راجع التاريخ.');
  const note=String(fd.get('note')||'').trim().slice(0,300);
  await save('smoking-relapse',localDate(smokedAt),{count,smokedAt,newQuitAt:newStart,previousQuitAt:oldCfg.quitAt,note});
  await saveSettings({...state.settings,smoking:{...oldCfg,start:localDate(newStart),quitAt:newStart}});
  dialog='';render();
  window.KhatwaToast.info('التسجيل اتحفظ. العداد بدأ محاولة جديدة، ومجهودك السابق لسه في السجل.');
  return true;
 }
 window.KhatwaQuit={elapsed,clock,reasonsCard,reminderActions,slipHistory,modal,action,submit,start,refresh,getReasons:names};
}());
