/* Khatwa quitting companion — automatic clock, personal motivations and supportive slip logging. */
(function(){
 'use strict';
 let reasonsEditing=false,dialog='',previousFocus=null,started=false;
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
  const reasons=names();
  return `<section class="quit-reasons-pin" aria-label="أسبابك الشخصية للإقلاع">
    <div class="quit-reasons-heading"><div><span class="quit-reasons-kicker">افتكر أنت بدأت ليه</span><h2>أسبابك للإقلاع</h2></div><button class="btn sm" type="button" data-action="quit-edit-reasons">${reasonsEditing?'إلغاء التعديل':reasons.length?'تعديل الأسباب':'ضيف أسبابك'}</button></div>
    ${reasons.length?`<ul class="quit-reasons-list">${reasons.map(item=>`<li><span aria-hidden="true">✓</span><span>${esc(item)}</span></li>`).join('')}</ul>`:'<p class="quit-reasons-empty">اكتب الأسباب اللي تهمك أنت. هتفضل قدامك هنا كل ما تفتح متابعة الإقلاع.</p>'}
    ${reasonsEditing?`<form data-form="quit-reasons" class="quit-reasons-form"><label for="quit-reasons-text">اكتب كل سبب في سطر مستقل</label><textarea id="quit-reasons-text" name="reasons" rows="4" maxlength="2500" placeholder="مثال: نفسي أتنفس براحة&#10;عاوز أوفر فلوسي">${esc(reasons.join('\n'))}</textarea><small>الأسباب شخصية ومش هنضيف أسباب من عندنا. الحد الأقصى 12 سبب.</small><button class="btn primary sm" type="submit">حفظ أسبابي</button></form>`:''}
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
 function action(a){
  if(a==='quit-edit-reasons'){reasonsEditing=!reasonsEditing;render();return true;}
  if(a==='quit-urge'||a==='quit-record-open'){open('urge');return true;}
  if(a==='quit-actually-smoked'){dialog='record';render();focusDialog();return true;}
  if(a==='quit-back'){dialog='urge';render();focusDialog();return true;}
  if(a==='quit-urge-passed'){close();window.KhatwaToast.success('اختيارك إنك تكمل من غير تدخين خطوة مهمة. خليك مع نفسك بهدوء.');return true;}
  if(a==='quit-close'){close();return true;}
  return false;
 }
 async function submit(form){
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
