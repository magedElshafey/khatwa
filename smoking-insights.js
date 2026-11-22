/* Smoking cessation insights: local, informational, and never an assertion of verified abstinence. */
(function () {
 'use strict';
 const NHS='https://www.nhs.uk/better-health/quit-smoking/ready-to-quit-smoking/what-could-happen-when-you-quit-smoking/';
 const CDC='https://www.cdc.gov/tobacco/about/benefits-of-quitting.html';
 const WHO='https://www.who.int/news-room/questions-and-answers/item/tobacco-health-benefits-of-smoking-cessation';
 const stages=[
  {hours:1/3,label:'بعد 20 دقيقة',title:'نبض القلب يبدأ يرجع لمستواه المعتاد',detail:'تبدأ التغيّرات المرتبطة بتحسن القلب والدورة الدموية بعد الإقلاع بوقت قصير.',source:'NHS',url:NHS},
  {hours:8,label:'بعد 8 ساعات',title:'انخفاض أول أكسيد الكربون',detail:'بحسب NHS، ينخفض أول أكسيد الكربون في الدم بشكل ملحوظ، وتبدأ مستويات الأكسجين في التعافي.',source:'NHS',url:NHS},
  {hours:48,label:'بعد 48 ساعة',title:'الشم والتذوق ممكن يتحسنوا',detail:'تبدأ حاستا الشم والتذوق تتحسّنان لدى كثير من الأشخاص؛ وقد يتغيّر الإحساس بطعم الطعام تدريجيًا.',source:'NHS',url:NHS},
  {hours:72,label:'بعد 72 ساعة',title:'التنفّس ممكن يبقى أسهل',detail:'قد تبدأ الشعب الهوائية في الاسترخاء، وبعض الناس يلاحظون سهولة أكبر في التنفّس.',source:'NHS',url:NHS},
  {hours:14*24,label:'من أسبوعين إلى 12 أسبوع',title:'فترة تحسن الدورة الدموية',detail:'خلال الأسابيع التالية للإقلاع، تتحسّن الدورة الدموية ووظائف الرئة تدريجيًا لدى كثير من الناس.',source:'WHO',url:WHO},
  {hours:30*24,label:'من شهر إلى 12 شهر',title:'تحسن السعال وضيق النفس مع الوقت',detail:'على مدار الشهور التالية، تقل أعراض مثل السعال وضيق النفس عند كثير من الأشخاص.',source:'CDC',url:CDC},
  {hours:365*24,label:'خلال سنة إلى سنتين',title:'انخفاض ملحوظ في خطر النوبة القلبية',detail:'تُظهر بيانات CDC أن خطر النوبة القلبية ينخفض بوضوح خلال السنة أو السنتين التاليتين للإقلاع.',source:'CDC',url:CDC},
  {hours:3650*24,label:'خلال 10 إلى 15 سنة',title:'انخفاض كبير في خطر سرطان الرئة',detail:'ينخفض الخطر الإضافي للإصابة بسرطان الرئة إلى نحو النصف مقارنة باستمرار التدخين بعد 10 إلى 15 سنة.',source:'CDC',url:CDC}
 ];
 const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function estimate(cfg,at=Date.now()){
  if(!cfg||typeof cfg.quitAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(cfg.quitAt))return {valid:false,reason:'حدّد تاريخ وساعة البداية من «تعديل الحساب» لعرض تقديرات الوقت.'};
  const start=new Date(cfg.quitAt).getTime();
  if(!Number.isFinite(start))return {valid:false,reason:'وقت بداية الإقلاع غير صالح؛ راجعه من الإعدادات.'};
  const ms=Math.max(0,Number(at)-start),hours=ms/3600000;
  const baseline=Number(cfg.avg),size=Number(cfg.packSize),price=Number(cfg.packPrice);
  const rate=Number.isFinite(baseline)&&baseline>0?baseline:0;
  const theoretical=rate*hours/24;
  return {valid:true,start,elapsedMs:ms,hours,future:Number(at)<start,
    cigarettes:Math.round(theoretical),rawCigarettes:theoretical,
    money:size>0&&Number.isFinite(price)&&price>=0?theoretical*price/size:0,
    reached:stages.filter(x=>hours>=x.hours),next:stages.find(x=>hours<x.hours)||null};
 }
 const format=(n,decimals=0)=>Number(n).toLocaleString('ar-EG',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
 function duration(hours){
  if(hours<=0)return 'دلوقتي';
  if(hours<48){const h=Math.floor(hours),min=Math.ceil((hours-h)*60);return (h?h+' ساعة ':'')+(min?min+' دقيقة':'');}
  const days=Math.ceil(hours/24);
  if(days<90)return days+' يوم تقريبًا';
  if(days<365)return Math.round(days/30)+' شهور تقريبًا';
  return (days/365).toFixed(1)+' سنة تقريبًا';
 }
 function predictions(cfg,at=Date.now()){
  const p=estimate(cfg,at);
  if(!p.valid)return `<div class="smoke-data-notice">${escapeHtml(p.reason)}</div>`;
  if(p.future)return '<div class="smoke-data-notice">وقت البداية اللي سجلته لسه ماجاش. التقديرات هتبدأ بعد الوقت ده.</div>';
  return `<div class="smoke-data-notice">الأرقام دي مقارنة حسابية بمتوسط التدخين السابق خلال الوقت اللي فات، <strong>بافتراض إنك ما دخّنتش منذ البداية</strong>. التطبيق ما يقدرش يتأكد من الامتناع تلقائيًا؛ وسجل الأيام الفعلية منفصل.</div>`;
 }
 function timeline(cfg,at=Date.now()){
  const p=estimate(cfg,at);
  if(!p.valid)return `<section class="smoke-health-section"><div class="sectiontitle"><h2>رحلة التعافي — معلومات علمية</h2></div><div class="card"><p class="muted">${escapeHtml(p.reason)}</p></div></section>`;
  if(p.future)return `<section class="smoke-health-section"><div class="sectiontitle"><h2>رحلة التعافي — معلومات علمية</h2></div><div class="card"><p class="muted">مستنيين وقت البداية اللي اخترته. تقدر تشوف المحطات الصحية العامة بعده.</p></div></section>`;
  const current=p.reached.length?p.reached[p.reached.length-1]:null,next=p.next;
  const top=`<div class="smoke-health-highlight"><div><span class="smoke-health-eyebrow">المرحلة الحالية حسب الوقت المسجّل</span><h3>${escapeHtml(current?current.title:'الرحلة بدأت')}</h3><p>${escapeHtml(current?current.detail:'التغيّرات الإيجابية ممكن تبدأ من أول 20 دقيقة بعد الإقلاع.')}</p></div>${next?`<div class="smoke-health-next"><span>المحطة المرجعية الجاية</span><strong>${escapeHtml(next.label)}</strong><small>متبقي ${duration(next.hours-p.hours)}</small></div>`:'<div class="smoke-health-next"><span>مراحل طويلة المدى</span><strong>الاستمرار هو الأهم</strong></div>'}</div>`;
  const cards=stages.map(item=>{
   const reached=p.hours>=item.hours;
   return `<div class="smoke-health-stage ${reached?'is-reached':'is-upcoming'}"><span class="smoke-stage-dot" aria-hidden="true"></span><div class="smoke-stage-body"><div class="smoke-stage-meta"><strong>${escapeHtml(item.label)}</strong><span>${reached?'الوقت المرجعي مرّ':'فترة قادمة'}</span></div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.detail)}</p><a href="${item.url}" target="_blank" rel="noopener noreferrer">المصدر: ${item.source}</a></div></div>`;
  }).join('');
  return `<section class="smoke-health-section" aria-label="مراحل التعافي العامة بعد الإقلاع">
  <div class="sectiontitle"><h2>جسمك بيتغيّر للأفضل — رحلة مبنية على العلم</h2></div>
  ${top}
  <details class="smoke-health-details"><summary>شوف المراحل الصحية والمصادر العلمية</summary><div class="smoke-health-timeline">${cards}</div></details>
  <p class="smoke-health-disclaimer">المراحل دي متوسطات عامة من جهات طبية موثوقة، ومش فحص لحالتك أو ضمان إن كل تأثير حصل في نفس الساعة. لو حصلت سيجارة بعد التاريخ المسجّل، راجع بداية الإقلاع وسجّل الأيام بصدق.</p>
  </section>`;
 }
 window.KhotwaSmokeInsights={estimate,timeline,predictions,stages};
}());
