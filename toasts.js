/* Khatwa Toast: dependency-free, Sonner-style notifications for vanilla TypeScript.
   One global host for every app module. Dynamic messages are always plain text. */
(function () {
 'use strict';
 const MAX_VISIBLE = 3;
 const DURATION = {success:3500,error:6500,warning:5300,info:4200};
 const LABEL = {success:'تم بنجاح',error:'حصلت مشكلة',warning:'تنبيه',info:'معلومة'};
 const ICON = {
  success:'<path d="m5 12 4 4L19 6"/>',
  error:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
  warning:'<path d="M10.4 3.7 2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.6 3.7a1.85 1.85 0 0 0-3.2 0Z"/><path d="M12 9v4m0 4h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'
 };
 let host=null;
 let serial=0;
 const live=new Map();
 const icon=type=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICON[type]+'</svg>';
 function ensureHost(){
  if(host && host.isConnected)return host;
  host=document.createElement('div');
  host.id='khatwa-toast-region';
  host.className='khatwa-toast-region';
  host.setAttribute('aria-label','إشعارات خطوة');
  host.setAttribute('dir','rtl');
  document.body.appendChild(host);
  return host;
 }
 function clean(entry){
  clearTimeout(entry.timer);
  live.delete(entry.id);
  entry.node.remove();
  if(host && live.size===0){host.remove();host=null;}
 }
 function dismiss(id){
  const entry=live.get(id);
  if(!entry||entry.closing)return;
  entry.closing=true;
  clearTimeout(entry.timer);
  entry.node.classList.add('is-leaving');
  entry.node.addEventListener('animationend',()=>clean(entry),{once:true});
  entry.timer=setTimeout(()=>clean(entry),240);
 }
 function dismissAll(){[...live.keys()].forEach(dismiss);}
 function schedule(entry){
  if(entry.duration===Infinity)return;
  entry.started=Date.now();
  entry.timer=setTimeout(()=>dismiss(entry.id),entry.remaining);
 }
 function pause(entry){
  if(entry.closing||entry.paused)return;
  entry.paused=true;
  clearTimeout(entry.timer);
  entry.remaining=Math.max(0,entry.remaining-(Date.now()-entry.started));
  entry.node.classList.add('is-paused');
 }
 function resume(entry){
  if(entry.closing||!entry.paused)return;
  entry.paused=false;
  entry.node.classList.remove('is-paused');
  schedule(entry);
 }
 function show(message,options={}){
  if(typeof document==='undefined'||!document.body)return null;
  const text=String(message??'').trim();
  if(!text)return null;
  const type=Object.hasOwn(DURATION,options.type)?options.type:'info';
  const duration=options.duration===Infinity?Infinity:Math.max(1500,Math.min(12000,Number(options.duration)||DURATION[type]));
  // Rapid repeated changes shouldn't stack the same notification on top of itself.
  for(const existing of live.values()){
   if(!existing.closing&&existing.message===text&&existing.type===type)return existing.id;
  }
  ensureHost();
  const id=++serial;
  const node=document.createElement('div');
  node.className='khatwa-toast khatwa-toast--'+type;
  node.setAttribute('role',type==='error'?'alert':'status');
  node.setAttribute('aria-live',type==='error'?'assertive':'polite');
  node.setAttribute('aria-atomic','true');
  node.style.setProperty('--toast-duration',Number.isFinite(duration)?duration+'ms':'0ms');
  const symbol=document.createElement('span');
  symbol.className='khatwa-toast-icon';
  symbol.innerHTML=icon(type); // Static SVG from our fixed icon dictionary.
  const content=document.createElement('span');
  content.className='khatwa-toast-content';
  const title=document.createElement('span');
  title.className='khatwa-toast-title';
  title.textContent=LABEL[type];
  const body=document.createElement('span');
  body.className='khatwa-toast-message';
  body.textContent=text; // Never interpolate user-provided text as markup.
  content.append(title,body);
  const close=document.createElement('button');
  close.type='button';
  close.className='khatwa-toast-close';
  close.setAttribute('aria-label','إغلاق الإشعار');
  close.textContent='×';
  node.append(symbol,content,close);
  if(duration!==Infinity){
   const progress=document.createElement('span');
   progress.className='khatwa-toast-progress';
   progress.setAttribute('aria-hidden','true');
   node.append(progress);
  }
  host.append(node);
  const entry={id,type,message:text,node,timer:null,duration,remaining:duration,started:0,paused:false,closing:false};
  live.set(id,entry);
  close.addEventListener('click',()=>dismiss(id));
  node.addEventListener('mouseenter',()=>pause(entry));
  node.addEventListener('mouseleave',()=>resume(entry));
  node.addEventListener('focusin',()=>pause(entry));
  node.addEventListener('focusout',event=>{if(!node.contains(event.relatedTarget))resume(entry);});
  // Horizontal swipe is dismissible on touch devices; vertical scroll remains untouched.
  let startX=null,startY=null;
  node.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'){startX=event.clientX;startY=event.clientY;}});
  node.addEventListener('pointerup',event=>{
   if(startX===null)return;
   const dx=event.clientX-startX,dy=event.clientY-startY;
   startX=null;startY=null;
   if(Math.abs(dx)>72&&Math.abs(dx)>Math.abs(dy)*1.4)dismiss(id);
  });
  while(live.size>MAX_VISIBLE)dismiss(live.keys().next().value);
  schedule(entry);
  return id;
 }
 window.KhatwaToast={
  show,
  success:(message,options={})=>show(message,{...options,type:'success'}),
  error:(message,options={})=>show(message,{...options,type:'error'}),
  warning:(message,options={})=>show(message,{...options,type:'warning'}),
  info:(message,options={})=>show(message,{...options,type:'info'}),
  dismiss,dismissAll
 };
}());
