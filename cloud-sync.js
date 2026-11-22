/* Khatwa Cloud Sync v1 — explicitly opt-in, append-only events with Supabase RLS.
   No photos or passwords are uploaded. Local IndexedDB remains authoritative offline. */
(function(){
'use strict';
const URL_BASE='https://ixndngfxnbnjeykdeqhd.supabase.co';
const API_KEY='sb_publishable_7-Nv0PIUCSJDQWw-ONN9Cw_Y3DBtCTw';
const AUTH_STORAGE='khotwa-cloud-session-v1', OWNER_STORAGE='khotwa-cloud-owner-v1';
let hooks=null,session=null,enabled=false,pending=[],working=false,queueLock=Promise.resolve(),lastError='',lastSynced='',poller=null,deviceId='';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state=()=>hooks.state;
const canRun=()=>!!(session&&enabled);
function saveSession(v){session=v;try{if(v)localStorage.setItem(AUTH_STORAGE,JSON.stringify(v));else localStorage.removeItem(AUTH_STORAGE);}catch{}}
function loadSession(){try{return JSON.parse(localStorage.getItem(AUTH_STORAGE)||'null')}catch{return null}}
function owner(){try{return localStorage.getItem(OWNER_STORAGE)||''}catch{return ''}}
function saveOwner(id){try{localStorage.setItem(OWNER_STORAGE,id)}catch{}}
const id=()=>crypto.randomUUID();
async function authRequest(path,options={}){
 const res=await fetch(URL_BASE+'/auth/v1/'+path,{...options,headers:{apikey:API_KEY,'Content-Type':'application/json',...(options.headers||{})}});
 const json=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(json.msg||json.error_description||json.message||'تعذر تسجيل الدخول');
 return json;
}
async function token(){
 if(!session)throw Error('سجّل دخول أولًا');
 if(session.expiresAt && Date.now()<session.expiresAt-60000)return session.access_token;
 if(!session.refresh_token)throw Error('جلسة الدخول انتهت، سجّل دخول من جديد');
 const json=await authRequest('token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})});
 saveSession({access_token:json.access_token,refresh_token:json.refresh_token,user:json.user||session.user,expiresAt:Date.now()+(json.expires_in||3600)*1000});
 return session.access_token;
}
async function request(path,{method='GET',body,prefer}={}){
 const jwt=await token();
 const res=await fetch(URL_BASE+'/rest/v1/'+path,{method,headers:{apikey:API_KEY,Authorization:'Bearer '+jwt,...(body?{'Content-Type':'application/json'}:{}),...(prefer?{Prefer:prefer}:{})},body:body?JSON.stringify(body):undefined});
 const text=await res.text();
 if(!res.ok)throw Error('تعذرت المزامنة ('+res.status+'): '+text.slice(0,180));
 return text?JSON.parse(text):null;
}
function safePayload(item){
 const data=JSON.parse(JSON.stringify(item));
 // Photos remain local until a private object-storage flow is reviewed.
 if(data.data && typeof data.data==='object'){
  for(const field of ['photo','image','photoData','imageData'])delete data.data[field];
 }
 if(JSON.stringify(data).length>350000)throw Error('السجل كبير جدًا للمزامنة. احتفظ بنسخة احتياطية وراجع المرفقات.');
 return data;
}
async function putMeta(key,data){await hooks.dbPut('meta',{id:key,data,updatedAt:new Date().toISOString()})}
function queueKey(){return 'cloud-outbox:'+session.user.id}
function cursorKey(){return 'cloud-cursor:'+session.user.id}
function enabledKey(){return 'cloud-enabled:'+session.user.id}
function deviceKey(){return 'cloud-device-v1'}
async function boot(){
 if(!hooks)return;
 const meta=await hooks.dbGetAll('meta');
 const device=meta.find(x=>x.id===deviceKey())?.data;
 deviceId=typeof device==='string'?device:id();
 if(!device)await putMeta(deviceKey(),deviceId);
 session=loadSession();
 if(!session?.user?.id){session=null;return}
 if(owner() && owner()!==session.user.id){saveSession(null);lastError='هذا الجهاز مرتبط بحساب آخر. احتفظ بنسخة احتياطية قبل تغيير الحساب.';return}
 try{
  const user=await authRequest('user',{headers:{Authorization:'Bearer '+await token()}});
  if(!user.id||user.id!==session.user.id)throw Error('تعذر تأكيد الحساب');
  enabled=meta.find(x=>x.id===enabledKey())?.data===true;
  pending=meta.find(x=>x.id===queueKey())?.data||[];
  if(enabled){startPolling();void sync();}
 }catch(err){lastError=err.message||String(err)}
}
async function submit(form){
 const kind=String(form.dataset.form);
 const fd=new FormData(form),email=String(fd.get('email')||'').trim().toLowerCase(),password=String(fd.get('password')||'');
 if(!email||password.length<8)throw Error('اكتب بريد إلكتروني وكلمة مرور لا تقل عن 8 أحرف');
 const submitBtn=form.querySelector('[type="submit"]');
 if(submitBtn)submitBtn.disabled=true;
 try{
  if(kind==='cloud-signup'){
   const data=await authRequest('signup?redirect_to='+encodeURIComponent(location.origin),{method:'POST',body:JSON.stringify({email,password})});
   if(data.access_token){await loginFromResponse(data);hooks.notice('الحساب اتجهز. فعل المزامنة لما تكون جاهز.');}
   else hooks.notice('اتبع رسالة تأكيد البريد الإلكتروني، وبعدها سجّل دخول هنا.');
  }else if(kind==='cloud-login'){
   const data=await authRequest('token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
   await loginFromResponse(data);
   hooks.notice('اتسجل دخولك. اختار بدء المزامنة من الإعدادات.');
  }
  hooks.render();
 }finally{if(submitBtn)submitBtn.disabled=false}
}
async function loginFromResponse(r){
 if(!r.user?.id||!r.access_token)throw Error('تعذر تأكيد جلسة الدخول');
 if(owner()&&owner()!==r.user.id)throw Error('هذا الجهاز مرتبط بحساب آخر. لا يمكن دمج بيانات حسابين دون نقل آمن.');
 saveSession({access_token:r.access_token,refresh_token:r.refresh_token,user:r.user,expiresAt:Date.now()+(r.expires_in||3600)*1000});
 const meta=await hooks.dbGetAll('meta');
 enabled=meta.find(x=>x.id===enabledKey())?.data===true;
 pending=meta.find(x=>x.id===queueKey())?.data||[];
 if(enabled){startPolling();await sync();}
}
async function enqueue(kind,operation,entityId,payload){
 if(!canRun())return;
 // Serialized persistence avoids losing rapid consecutive local edits.
 queueLock=queueLock.catch(()=>{}).then(async()=>{
  const event={id:id(),user_id:session.user.id,device_id:deviceId,entity_id:entityId,kind,operation,payload:operation==='delete'?{}:safePayload(payload)};
  pending.push(event);
  await putMeta(queueKey(),pending);
 });
 await queueLock;
 void sync();
}
function startPolling(){
 if(poller)return;
 poller=setInterval(()=>{if(navigator.onLine!==false&&canRun())void sync()},45000);
}
async function loadEvents(){
 const out=[];const cursorRecord=(await hooks.dbGetAll('meta')).find(x=>x.id===cursorKey())?.data;
 let offset=0;
 for(let page=0;page<50;page++){
  const params=new URLSearchParams({select:'id,device_id,entity_id,kind,operation,payload,created_at',order:'created_at.asc,id.asc',limit:'500',offset:String(offset)});
  if(cursorRecord?.createdAt)params.set('created_at','gte.'+cursorRecord.createdAt);
  const pageItems=await request('khatwa_events?'+params.toString());
  if(!Array.isArray(pageItems))throw Error('استجابة المزامنة غير صالحة');
  for(const ev of pageItems){
   if(cursorRecord?.createdAt && (ev.created_at<cursorRecord.createdAt || (ev.created_at===cursorRecord.createdAt && ev.id<=cursorRecord.id)))continue;
   out.push(ev);
  }
  if(pageItems.length<500)break;
  offset+=500;
  if(page===49)throw Error('عدد تحديثات كبير؛ يلزم تقسيم المزامنة');
 }
 return out;
}
async function persistQueue(){await putMeta(queueKey(),pending)}
async function pushPending(){
 await queueLock;
 while(pending.length){
  const batch=pending.slice(0,30);
  await request('khatwa_events?on_conflict=id',{method:'POST',body:batch,prefer:'resolution=ignore-duplicates,return=minimal'});
  pending=pending.slice(batch.length);
  await persistQueue();
 }
}
async function applyEvent(ev){
 if(ev.kind==='settings'){
  if(ev.operation==='upsert' && ev.payload?.data && typeof ev.payload.data==='object'){
   state().settings={...hooks.defaults,...ev.payload.data};
   await hooks.dbPut('meta',{id:'settings',data:state().settings,updatedAt:ev.payload.updatedAt||new Date().toISOString()});
   return true;
  }
  return false;
 }
 if(ev.kind!=='record'||typeof ev.entity_id!=='string')return false;
 if(ev.operation==='delete'){
  await hooks.dbDelete('records',ev.entity_id);
  state().rows=state().rows.filter(x=>x.id!==ev.entity_id);
  return true;
 }
 const r=ev.payload;
 if(!r||r.id!==ev.entity_id||typeof r.collection!=='string'||typeof r.date!=='string'||!r.data||typeof r.data!=='object')return false;
 const existing=state().rows.find(x=>x.id===r.id);
 // Keep private local-only image data even when a remote record is updated.
 const data={...r.data};
 if(existing?.data?.photo&&!data.photo)data.photo=existing.data.photo;
 const item={id:r.id,collection:r.collection,date:r.date,data,updatedAt:r.updatedAt||new Date().toISOString()};
 await hooks.dbPut('records',item);
 state().rows=state().rows.filter(x=>x.id!==item.id).concat(item);
 return true;
}
async function sync(){
 if(!canRun()||working||navigator.onLine===false)return;
 working=true;lastError='';
 try{
  await pushPending();
  const changes=await loadEvents();
  let changed=false;
  for(const ev of changes){
   changed=await applyEvent(ev)||changed;
   await putMeta(cursorKey(),{createdAt:ev.created_at,id:ev.id});
  }
  lastSynced=new Date().toLocaleTimeString('ar-EG',{hour:'numeric',minute:'2-digit'});
  if(changed&&state().db)hooks.render();
 }catch(e){lastError=String(e.message||e)}
 finally{working=false;}
}
async function enable(){
 if(!session?.user?.id)throw Error('سجّل دخول الأول');
 const existing=state().rows;
 let cloudCount=0;
 const count=await request('khatwa_events?select=id&limit=1');
 cloudCount=Array.isArray(count)?count.length:0;
 if(existing.length){
  const msg=cloudCount
   ?'فيه بيانات بالفعل في السحابة، وكمان '+existing.length+' سجل على الجهاز. رفع النسخة المحلية ممكن يستبدل أحدث قيمة لنفس السجل. يُفضّل تصدير Backup أولًا. هل توافق على الدمج مع أولوية التعديل المحلي؟'
   :'هنرفع '+existing.length+' سجل موجود على الجهاز مع الإعدادات الحالية لحسابك. الصور الشخصية هتفضل على الجهاز فقط. صدّر Backup قبل النقل. توافق؟';
  if(!confirm(msg))return;
 }else if(!confirm('هنبدأ مزامنة بيانات حسابك على الجهاز ده. التغييرات الجديدة هتتحفظ محليًا وفي السحابة. موافق؟'))return;
 if(owner()&&owner()!==session.user.id)throw Error('الجهاز مرتبط بمستخدم مختلف');
 saveOwner(session.user.id);
 // Never mark sync enabled before the initial snapshot is safely queued.
 const init=[];
 if(existing.length)for(const r of existing){
  init.push({id:id(),user_id:session.user.id,device_id:deviceId,entity_id:r.id,kind:'record',operation:'upsert',payload:safePayload(r)});
 }
 if(existing.length||!cloudCount){
  init.push({id:id(),user_id:session.user.id,device_id:deviceId,entity_id:'settings',kind:'settings',operation:'upsert',payload:{data:state().settings,updatedAt:new Date().toISOString()}});
 }
 pending.push(...init);
 await putMeta(queueKey(),pending);
 enabled=true;await putMeta(enabledKey(),true);
 startPolling();await sync();hooks.render();
 hooks.notice(lastError?'تم تشغيل المزامنة، وفيه مشكلة اتصال: '+lastError:'تم ربط الجهاز، والمزامنة شغّالة.');
}
async function disable(){
 if(!session)return;
 enabled=false;
 await putMeta(enabledKey(),false);
 hooks.render();hooks.notice('تم إيقاف المزامنة على الجهاز ده. السجلات المحلية محفوظة.');
}
async function signout(){
 if(enabled&&!confirm('تسجيل الخروج هيوقف المزامنة مؤقتًا، لكن البيانات المحلية هتفضل موجودة على الجهاز. موافق؟'))return;
 enabled=false;saveSession(null);pending=[];hooks.render();
 hooks.notice('اتسجّل خروجك. السجلات المحلية لسه محفوظة على الجهاز.');
}
async function action(name){
 if(name==='cloud-enable')return enable();
 if(name==='cloud-disable')return disable();
 if(name==='cloud-sync-now'){await sync();hooks.render();hooks.notice(lastError||'تمت محاولة المزامنة.');return}
 if(name==='cloud-signout')return signout();
}
function panel(){
 const info=lastError?'⚠️ '+esc(lastError):enabled?'المزامنة مفعّلة على الجهاز ده.':session?'الحساب متصل، لكن نقل البيانات لسه محتاج موافقتك.':'لا يوجد حساب متصل.';
 const label=esc(session?.user?.email||'');
 if(!session)return `<div class="card cloud-card"><div class="cardhead"><h3>حسابك والمزامنة</h3><span class="pill amber">غير متصل</span></div><p class="muted">افتح نفس بياناتك من الموبايل والكمبيوتر. بيانات الجهاز مش هتترفع قبل موافقتك.</p><div class="grid g2"><form data-form="cloud-login"><h3>تسجيل الدخول</h3><div class="field"><label>البريد الإلكتروني</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>كلمة المرور</label><input name="password" type="password" autocomplete="current-password" minlength="8" required></div><button class="btn primary" type="submit">دخول</button></form><form data-form="cloud-signup"><h3>حساب جديد</h3><div class="field"><label>البريد الإلكتروني</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>كلمة مرور جديدة (8 أحرف أو أكثر)</label><input name="password" type="password" autocomplete="new-password" minlength="8" required></div><button class="btn" type="submit">إنشاء حساب</button></form></div><p class="hint">لو أنشأت حسابًا جديدًا، ممكن يوصلك بريد لتأكيده. ما تبعتش كلمة مرورك لأي حد.</p></div>`;
 return `<div class="card cloud-card"><div class="cardhead"><h3>حسابك والمزامنة</h3><span class="pill ${enabled?'green':'amber'}">${enabled?'مفعّلة':'متوقفة'}</span></div><p class="muted">الحساب: ${label}</p><p class="hint">${info}</p>
 <div class="row cloud-actions">${enabled?'<button class="btn" data-action="cloud-sync-now">زامن دلوقتي</button><button class="btn" data-action="cloud-disable">إيقاف المزامنة</button>':'<button class="btn primary" data-action="cloud-enable">بدء المزامنة ونقل بيانات الجهاز بإذن مني</button>'}<button class="btn ghost" data-action="cloud-signout">تسجيل خروج</button></div>
 ${enabled?`<p class="hint">آخر مزامنة: ${esc(lastSynced||'لم تكتمل بعد')} · تحديث كل 45 ثانية تقريبًا وعند رجوع الاتصال · في انتظار الرفع: ${pending.length}</p>`:''}
 <div class="notice amber">الصور الشخصية بتفضل على الجهاز فقط. والمزامنة بتستخدم آخر تعديل وصل للسحابة عند تكرار نفس السجل؛ احتفظ بنسخة احتياطية قبل النقل بين أجهزة فيها سجلات مختلفة.</div></div>`;
}
window.KhotwaCloud={
 init:async h=>{hooks=h;await boot();},
 panel,submit,action,enqueue,sync,isActive:()=>canRun(),
 getStatus:()=>({connected:!!session,enabled,pending:pending.length,lastError,lastSynced}),
 sanitize:safePayload
};
}());
