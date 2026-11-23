/* Khatwa Cloud Sync v1 — explicitly opt-in, append-only events with Supabase RLS.
   No photos or passwords are uploaded. Local IndexedDB remains authoritative offline. */
(function(){
'use strict';
const URL_BASE='https://ixndngfxnbnjeykdeqhd.supabase.co';
const API_KEY='sb_publishable_7-Nv0PIUCSJDQWw-ONN9Cw_Y3DBtCTw';
const AUTH_STORAGE='khotwa-cloud-session-v1', OWNER_STORAGE='khotwa-cloud-owner-v1';
let hooks=null,session=null,enabled=false,pending=[],working=false,queueLock=Promise.resolve(),lastError='',lastSynced='',poller=null,deviceId='',ready=false,prepared=false,migrationRequired=false,legacyImported=false,authMode='login',authNotice='',legacySnapshot={rows:[],settings:null,meta:[]};
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
function linkedKey(){return 'cloud-account-ready:'+session.user.id}
function deviceKey(){return 'cloud-device-v1'}
async function boot(){
 if(!hooks)return;
 // Capture the original anonymous IndexedDB before switching to an account-specific DB.
 const originalMeta=await hooks.dbGetAll('meta');
 legacySnapshot={rows:state().rows.slice(),settings:state().settings,meta:originalMeta};
 const device=originalMeta.find(x=>x.id===deviceKey())?.data;
 deviceId=typeof device==='string'?device:id();
 if(!device)await putMeta(deviceKey(),deviceId);
 session=loadSession();
 if(!session?.user?.id){session=null;return}
 // Persistent sessions work across browser restarts. Refresh expired tokens online.
 if(navigator.onLine!==false){
  try{
   const user=await authRequest('user',{headers:{Authorization:'Bearer '+await token()}});
   if(!user.id||user.id!==session.user.id)throw Error('تعذر تأكيد حسابك، سجّل الدخول مرة أخرى.');
  }catch(e){
   // Network errors don't log out a previously trusted device; invalid credentials do.
   if(e instanceof TypeError){lastError='مش قادر أتصل بالسحابة الآن؛ هنستخدم النسخة المحلية المربوطة بحسابك.'}
   else {saveSession(null);lastError='جلسة الدخول انتهت. سجّل دخولك مرة تانية.';return}
  }
 }
 await connectAccount();
}
async function connectAccount(){
 if(!session?.user?.id)throw Error('سجّل دخول أولًا');
 await hooks.switchAccountDatabase(session.user.id);
 const meta=await hooks.dbGetAll('meta');
 pending=meta.find(x=>x.id===queueKey())?.data||[];
 if(!Array.isArray(pending))pending=[];
 const linked=meta.find(x=>x.id===linkedKey())?.data===true;
 legacyImported=meta.find(x=>x.id==='cloud-legacy-imported:'+session.user.id)?.data===true;
 const legacyOwned=owner();
 const canImportLegacy=legacySnapshot.rows.length && (!legacyOwned||legacyOwned===session.user.id);
 if(!linked&&canImportLegacy){
  migrationRequired=true;prepared=false;enabled=false;return;
 }
 migrationRequired=false;
 prepared=true;
 enabled=true;
 if(!linked)await putMeta(linkedKey(),true);
 await putMeta(enabledKey(),true);
 startPolling();
 if(navigator.onLine!==false)await sync();
}
async function importLegacy(){
 if(!session?.user?.id)throw Error('سجّل دخول الأول');
 if(!migrationRequired&&prepared&&legacySnapshot.rows.length===0)return;
 if(owner()&&owner()!==session.user.id)throw Error('البيانات القديمة تخص حسابًا مختلفًا.');
 const records=legacySnapshot.rows;
 if(!records.length){await prepareWithoutImport();return}
 if(!confirm('هننسخ '+records.length+' سجل من بيانات الجهاز القديمة إلى حسابك السحابي. احتفظ بنسخة احتياطية قبل الاستيراد. هل توافق؟'))return;
 if(navigator.onLine!==false){
  const server=await request('khatwa_events?select=id&limit=1');
  if(server?.length&&!confirm('الحساب فيه بيانات على السحابة بالفعل. لو سجل قديم له نفس المعرّف، آخر تعديل مستورد ممكن يتغلب على السجل السحابي. هل توافق على الدمج؟'))return;
 }
 for(const r of records){
  await hooks.dbPut('records',r);
  state().rows=state().rows.filter(x=>x.id!==r.id).concat(r);
  pending.push({id:id(),user_id:session.user.id,device_id:deviceId,entity_id:r.id,kind:'record',operation:'upsert',payload:safePayload(r)});
 }
 if(legacySnapshot.settings){
  state().settings={...hooks.defaults,...legacySnapshot.settings};
  await hooks.dbPut('meta',{id:'settings',data:state().settings,updatedAt:new Date().toISOString()});
  pending.push({id:id(),user_id:session.user.id,device_id:deviceId,entity_id:'settings',kind:'settings',operation:'upsert',payload:{data:state().settings,updatedAt:new Date().toISOString()}});
 }
 const oldPending=legacySnapshot.meta.find(x=>x.id==='cloud-outbox:'+session.user.id)?.data;
 if(Array.isArray(oldPending))pending.push(...oldPending.filter(e=>e&&e.user_id===session.user.id));
 await putMeta(queueKey(),pending);
 await putMeta('cloud-legacy-imported:'+session.user.id,true);legacyImported=true;
 await finishLink();
 authNotice='استوردنا سجلات الجهاز القديمة. لو الإنترنت فصل هتكمل المزامنة لما يرجع.';
 hooks.render();
}
async function prepareWithoutImport(){
 if(!confirm('بيانات الجهاز القديمة هتفضل محفوظة في تخزينها الأصلي ومش هنرفعها أو نحذفها. هنفتح بيانات حسابك السحابي فقط. تكمل؟'))return;
 await finishLink();
 authNotice='تم ربط الحساب. بيانات الجهاز القديمة محفوظة بشكل منفصل.';
 hooks.render();
}
async function finishLink(){
 await putMeta(linkedKey(),true);
 await putMeta(enabledKey(),true);
 migrationRequired=false;prepared=true;enabled=true;
 startPolling();
 if(navigator.onLine!==false)await sync();
}
async function submit(form){
 const kind=String(form.dataset.form);
 const fd=new FormData(form),email=String(fd.get('email')||'').trim().toLowerCase(),password=String(fd.get('password')||'');
 if(!email||password.length<8)throw Error('اكتب بريد إلكتروني صحيح وكلمة مرور من 8 أحرف على الأقل');
 const button=form.querySelector('[type="submit"]');
 if(button)button.disabled=true;
 lastError='';authNotice='';
 try{
  if(kind==='cloud-signup'){
   const data=await authRequest('signup?redirect_to='+encodeURIComponent(location.origin+'/'),{method:'POST',body:JSON.stringify({email,password})});
   if(data.access_token){await loginFromResponse(data)}
   else {authMode='login';authNotice='بعتنا رسالة تأكيد للبريد الإلكتروني. افتح الرابط ثم ارجع سجّل دخول بنفس الإيميل والباسورد.'}
  }else if(kind==='cloud-login'){
   const data=await authRequest('token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
   await loginFromResponse(data);
  }
 }catch(error){lastError=String(error.message||error);throw error}
 finally{if(button)button.disabled=false;hooks.render()}
}
async function loginFromResponse(r){
 if(!r.user?.id||!r.access_token)throw Error('تعذر تأكيد جلسة الدخول');
 if(session?.user?.id && session.user.id!==r.user.id){enabled=false;prepared=false;pending=[]}
 saveSession({access_token:r.access_token,refresh_token:r.refresh_token,user:r.user,expiresAt:Date.now()+(r.expires_in||3600)*1000});
 await connectAccount();
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
 window.addEventListener('online',()=>{if(canRun())void sync()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&canRun())void sync()});
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
 if(pending.some(x=>x.entity_id===ev.entity_id&&x.kind===ev.kind))return false;
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
async function signout(){
 if(working){hooks.notice('المزامنة شغالة دلوقتي. جرّب تسجيل الخروج بعد لحظات.');return;}
 if(pending.length && !confirm('فيه تغييرات لسه مستنية اتصال الإنترنت عشان تتزامن. الأفضل تستنى قبل تسجيل الخروج. تخرج رغم كده؟'))return;
 if(!confirm('تسجيل خروج من الجهاز ده؟ مش هيمسح بيانات حسابك من السحابة.'))return;
 enabled=false;prepared=false;migrationRequired=false;
 saveSession(null);pending=[];lastError='';lastSynced='';authNotice='';
 // Never render the previous account's in-memory data on the login screen.
 state().rows=[];state().settings={...hooks.defaults};
 hooks.render();
}
async function action(name){
 if(name==='cloud-auth-login'){authMode='login';lastError='';hooks.render();return}
 if(name==='cloud-auth-signup'){authMode='signup';lastError='';hooks.render();return}
 if(name==='cloud-import-legacy')return importLegacy();
 if(name==='cloud-skip-legacy')return prepareWithoutImport();
 if(name==='cloud-export-legacy'){await hooks.exportLegacy(legacySnapshot.rows,legacySnapshot.settings);return}
 if(name==='cloud-sync-now'){await sync();hooks.render();hooks.notice(lastError||'تمت محاولة المزامنة.');return}
 if(name==='cloud-signout')return signout();
}
function loadingView(){
 return '<div class="auth-shell" dir="rtl"><div class="auth-card card"><div class="auth-brand">✓ <strong>خطوة</strong></div><p role="status">بنفتح حسابك ونجهّز بياناتك…</p></div></div>';
}
function loginView(){
 const isSignup=authMode==='signup',title=isSignup?'إنشاء حساب جديد':'تسجيل الدخول',formName=isSignup?'cloud-signup':'cloud-login';
 return `<main class="auth-shell" dir="rtl"><div class="auth-layout">
 <section class="auth-intro"><div class="auth-brand"><span class="auth-logo">✓</span><strong>خطوة</strong></div><p class="auth-eyebrow">PERSONAL LIFE OS</p><h1>حياتك، في مكان واحد.</h1><p>تعلّمك، تمرينك، تغذيتك، وعاداتك… سجّل دخولك وشوف نفس بياناتك على الموبايل والكمبيوتر.</p><div class="auth-benefits"><span>☑ مزامنة تلقائية</span><span>☑ شغال بدون إنترنت بعد تسجيل الدخول</span><span>☑ بيانات كل حساب منفصلة</span></div></section>
 <section class="auth-card card" aria-label="${title}">
 <div class="auth-toggle"><button type="button" data-action="cloud-auth-login" class="${!isSignup?'selected':''}" aria-pressed="${!isSignup}">تسجيل الدخول</button><button type="button" data-action="cloud-auth-signup" class="${isSignup?'selected':''}" aria-pressed="${isSignup}">حساب جديد</button></div>
 <h2>${title}</h2><p class="muted">${isSignup?'اعمل حساب مرة واحدة عشان بياناتك تفضل مرتبطة بيه.':'أهلًا برجوعك. جلسة الدخول هتفضل محفوظة على الجهاز ده.'}</p>
 ${lastError?`<div role="alert" class="notice amber auth-feedback">${esc(lastError)}</div>`:''}
 ${authNotice?`<div role="status" class="notice auth-feedback">${esc(authNotice)}</div>`:''}
 <form data-form="${formName}" class="auth-form">
 <div class="field"><label for="auth-email">البريد الإلكتروني</label><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="name@example.com" required></div>
 <div class="field"><label for="auth-password">كلمة المرور</label><input id="auth-password" name="password" type="password" autocomplete="${isSignup?'new-password':'current-password'}" minlength="8" placeholder="8 أحرف على الأقل" required></div>
 <button class="btn primary auth-submit" type="submit">${isSignup?'إنشاء حساب':'دخول إلى خطوة'}</button>
 </form><p class="hint auth-footnote">${isSignup?'ممكن تحتاج تأكيد البريد الإلكتروني.':'لو الحساب جديد ولسه ما أكدتهوش، افتح رابط التأكيد من بريدك أولًا.'} لا تشارك كلمة المرور أو رابط التأكيد مع أي حد.</p></section>
 </div></main>`;
}
function migrationView(){
 const count=legacySnapshot.rows.length;
 return `<main class="auth-shell" dir="rtl"><div class="auth-card card auth-migration">
 <div class="auth-brand"><span class="auth-logo">✓</span><strong>خطوة</strong></div>
 <h1>أهلًا بيك في حسابك</h1><p>لقينا <strong>${count} سجل قديم</strong> على الجهاز ده قبل ربط الحساب. مش هنرفعهم من غير اختيارك، ومش هنحذفهم.</p>
 <div class="notice amber">لو نقلتهم، هيبقوا جزء من بيانات حسابك ويمكن يظهروا على الأجهزة التانية. الصور الشخصية بتفضل محلية. يُفضّل تصدّر نسخة احتياطية الأول.</div>
 ${lastError?`<div role="alert" class="notice amber">${esc(lastError)}</div>`:''}
 <div class="auth-migration-actions"><button class="btn" data-action="cloud-export-legacy">نزّل Backup من البيانات القديمة</button><button class="btn primary" data-action="cloud-import-legacy">استيراد ${count} سجل إلى حسابي</button><button class="btn" data-action="cloud-skip-legacy">استخدم بيانات حسابي فقط بدون نقل</button></div>
 <p class="hint">البيانات القديمة هتفضل محفوظة في التخزين المحلي الأصلي حتى لو اخترت عدم نقلها. الحسابات الجديدة متفصلة عن بعضها.</p>
 </div></main>`;
}
function panel(){
 return `<div class="card cloud-card"><div class="cardhead"><h3>حسابك والمزامنة</h3><span class="pill green">متصل</span></div>
 <p class="muted">مسجّل دخول باسم ${esc(session?.user?.email||'حسابك')}.</p>
 ${lastError?`<div class="notice amber">${esc(lastError)}</div>`:''}
 ${authNotice?`<p class="hint">${esc(authNotice)}</p>`:''}
 <div class="row cloud-actions"><button class="btn" data-action="cloud-sync-now">زامن دلوقتي</button><button class="btn ghost" data-action="cloud-signout">تسجيل خروج</button></div>
 <p class="hint">آخر اتصال ناجح: ${esc(lastSynced||'جاري التحضير أو بدون اتصال')} · في انتظار الرفع: ${pending.length} · التحديثات بتتسحب تلقائيًا.</p>
 <div class="notice">الصور الخاصة بتفضل على جهازك. البيانات التانية بتتزامن مع حسابك لما الإنترنت يكون متاح. سجل التغييرات على السحابة يحفظ التحديثات ويحل تعارض نفس السجل بآخر تغيير وصل.</div>
 ${legacySnapshot.rows.length&&!legacyImported&&(!owner()||owner()===session?.user?.id)?'<button class="btn sm" data-action="cloud-import-legacy">استيراد بيانات الجهاز القديمة</button>':''}
 </div>`;
}
window.KhotwaCloud={
 init:async h=>{hooks=h;try{await boot()}catch(e){lastError=String(e.message||e);saveSession(null);prepared=false}finally{ready=true}},
 panel,submit,action,enqueue,sync,
 isActive:()=>canRun(),isReady:()=>ready,isAuthenticated:()=>!!session?.user?.id,isPrepared:()=>prepared,
 loginView,migrationView,loadingView,
 getStatus:()=>({connected:!!session,enabled,prepared,migrationRequired,pending:pending.length,lastError,lastSynced}),
 sanitize:safePayload
};
}());
