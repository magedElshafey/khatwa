/* Khotwa Nutrition v2: local-first meal diary plus opt-in Open Food Facts search.
 * Generic examples are approximations per 100g edible portion, never branded measurements.
 * User's diary stays in IndexedDB; only the search term is sent to Open Food Facts on request.
 */
(function () {
  'use strict';

  const MEALS = [
    { id: 'breakfast', label: 'الإفطار', icon: '☀', color: 'sun' },
    { id: 'lunch', label: 'الغداء', icon: '◉', color: 'mint' },
    { id: 'dinner', label: 'العشاء', icon: '☾', color: 'violet' },
    { id: 'snack', label: 'سناكس', icon: '✦', color: 'rose' },
    { id: 'unsorted', label: 'سجلات قديمة', icon: '▤', color: 'neutral' }
  ];
  // Reference examples for generic foods. Variation between brands, cooking methods,
  // moisture levels and Egyptian recipes can be substantial. Values are NOT verified labels.
  // Fields: kcal, protein, carbohydrate, total fat, saturated fat, per 100g.
  const CATALOG = [
    ['cottage-full','جبنة قريش كامل الدسم','full fat cottage cheese',98,11.1,3.4,4.3,1.7,'تقدير لصنف عام؛ المنتج البلدي ممكن يختلف'],
    ['cottage-light','جبنة قريش قليلة الدسم','low fat cottage cheese',72,12.4,2.7,1,0.6],
    ['boiled-egg','بيض مسلوق','boiled egg',155,12.6,1.1,10.6,3.3],
    ['chicken-breast','صدور فراخ مطبوخة بدون جلد','cooked chicken breast',165,31,0,3.6,1],
    ['chicken-thigh','وراك فراخ مطبوخة بدون جلد','cooked chicken thigh',209,26,0,10.9,3],
    ['cooked-rice','أرز أبيض مطبوخ','cooked white rice',130,2.7,28.2,0.3,0.1],
    ['basmati','أرز بسمتي مطبوخ','cooked basmati rice',130,2.7,28.2,0.3,0.1],
    ['pasta','مكرونة مسلوقة','cooked pasta',158,5.8,30.9,0.9,0.2],
    ['potato','بطاطس مسلوقة بدون زيت','boiled potato',87,1.9,20.1,0.1,0.03],
    ['sweet-potato','بطاطا مشوية بدون إضافات','baked sweet potato',90,2,20.7,0.2,0.04],
    ['banana','موز','banana',89,1.1,22.8,0.3,0.1],
    ['apple','تفاح','apple',52,0.3,13.8,0.2,0.03],
    ['oats','شوفان جاف','dry oats',389,16.9,66.3,6.9,1.2],
    ['milk-full','لبن بقري كامل الدسم','whole milk',61,3.2,4.8,3.3,1.9],
    ['yogurt-full','زبادي طبيعي كامل الدسم','plain whole milk yogurt',61,3.5,4.7,3.3,2.1],
    ['tomato','طماطم','tomato',18,0.9,3.9,0.2,0.03],
    ['cucumber','خيار','cucumber',15,0.7,3.6,0.1,0.04],
    ['lentils','عدس مسلوق','boiled lentils',116,9,20.1,0.4,0.05],
    ['chickpeas','حمص مسلوق','boiled chickpeas',164,8.9,27.4,2.6,0.3],
    ['peanuts','فول سوداني نيّ','raw peanuts',567,25.8,16.1,49.2,6.3],
    ['olive-oil','زيت زيتون','olive oil',884,0,0,100,13.8],
    ['shrimp','جمبري مسلوق بدون قشر','boiled shrimp peeled',99,24,0,0.3,0.1],
    ['dates','تمر','dates',277,1.8,75,0.2,0.03],
    ['cauliflower','قرنبيط مطبوخ بدون زيت','cooked cauliflower',23,1.8,4.1,0.4,0.1],
    ['carrots','جزر نيّ','raw carrots',41,0.9,9.6,0.2,0.04],
    ['grilled-fish','سمك أبيض مشوي بدون زيت','grilled white fish',128,26,0,2.7,0.7],
    ['beef-lean','لحم بقري مطبوخ قليل الدهن','cooked lean beef',217,26,0,12,4.6],
    ['bread-baladi','عيش بلدي','egyptian baladi bread',270,9,53,1.5,0.3,'قيمة تقريبية؛ وزن الرغيف وتركيبه بيختلف'],
    ['balila','بليلة قمح مسلوقة بدون سكر أو لبن','boiled wheat berries',111,4,23,0.5,0.1]
  ].map(([id,name,en,kcal,protein,carbs,fat,satfat,note]) => ({
    id: 'ref:' + id, name, en, kcal, protein, carbs, fat, satfat,
    source: 'reference', note: note || 'تقدير مرجعي لصنف عام، مش بطاقة منتج بعينه'
  }));

  // More unbranded examples. As with all reference foods, these are approximate
  // values for edible portions, NOT values for a specific Egyptian recipe/brand.
  const ADDITIONAL_FOODS = [
    ['ful','فول مدمس مسلوق بدون زيت','plain cooked fava beans',110,7.6,19.7,0.4,0.1],
    ['white-beans','فاصوليا بيضاء مسلوقة بدون زيت','boiled white beans',139,9.7,25.1,0.4,0.1],
    ['bulgur','برغل مطبوخ بدون زيت','cooked bulgur',83,3.1,18.6,0.2,0.05],
    ['brown-rice','أرز بني مطبوخ','cooked brown rice',112,2.3,23.5,0.8,0.2],
    ['tuna-water','تونة مصفاة محفوظة في الماء','canned tuna in water drained',116,25.5,0,0.8,0.2],
    ['tuna-oil','تونة مصفاة محفوظة في الزيت','canned tuna in oil drained',198,29,0,8.2,1.4],
    ['sardines','سردين معلب مع العظام','canned sardines',208,24.6,0,11.5,1.5],
    ['salmon','سلمون مطبوخ','cooked salmon',206,22.1,0,12.4,3.1],
    ['turkey-breast','صدر رومي مطبوخ بدون جلد','cooked turkey breast',135,29,0,1.7,0.5],
    ['greek-yogurt','زبادي يوناني سادة قليل الدسم','plain low fat greek yogurt',73,10,3.9,1.9,1.2],
    ['feta','جبنة فيتا','feta cheese',264,14.2,4.1,21.3,14.9],
    ['peanut-butter','زبدة فول سوداني بدون سكر','unsweetened peanut butter',588,25,20,50,10],
    ['almonds','لوز نيّ','raw almonds',579,21.2,21.6,49.9,3.8],
    ['walnuts','عين جمل نيّ','raw walnuts',654,15.2,13.7,65.2,6.1],
    ['orange','برتقال','orange',47,0.9,11.8,0.1,0],
    ['grapes','عنب','grapes',69,0.7,18.1,0.2,0.1],
    ['watermelon','بطيخ','watermelon',30,0.6,7.6,0.2,0],
    ['strawberries','فراولة','strawberries',32,0.7,7.7,0.3,0],
    ['avocado','أفوكادو','avocado',160,2,8.5,14.7,2.1],
    ['zucchini','كوسة مطبوخة بدون زيت','cooked zucchini',17,1.2,3.1,0.3,0.1],
    ['bell-pepper','فلفل رومي أخضر نيّ','raw green bell pepper',20,0.9,4.6,0.2,0.1],
    ['onion','بصل نيّ','raw onion',40,1.1,9.3,0.1,0],
    ['lettuce','خس نيّ','raw lettuce',15,1.4,2.9,0.2,0],
    ['corn','ذرة حلوة مسلوقة بدون إضافات','boiled sweet corn',96,3.4,21,1.5,0.2],
    ['popcorn','فشار بدون زيت أو زبدة','air popped popcorn',387,12.9,77.8,4.5,0.6],
    ['oatmeal','شوفان مطبوخ بالمياه','oats cooked in water',71,2.5,12,1.5,0.3],
    ['wholewheat-bread','توست أسمر قمح كامل','whole wheat bread',247,13,41,4.2,0.9],
    ['chicken-whole','فراخ مشوية بدون جلد (جزء مأكول)','grilled chicken skinless meat',190,27,0,8.8,2.4],
    ['minced-beef','لحمة مفرومة مطبوخة قليلة الدهن','cooked lean ground beef',217,26,0,12,4.5],
    ['vegetable-mix','خضار مشكل مسلوق بدون زيت','boiled mixed vegetables',55,2.4,11,0.4,0.1]
  ].map(([id,name,en,kcal,protein,carbs,fat,satfat])=>({
    id:'ref:'+id,name,en,kcal,protein,carbs,fat,satfat,source:'reference',
    note:'قيمة تقريبية لصنف عام. طريقة التسوية والإضافات والمنتج قد تغيّر القيم.'
  }));
  CATALOG.push(...ADDITIONAL_FOODS);
  const SEARCH_ALIASES={
    'ref:ful':'فول فول مدمس فوا beans',
    'ref:cottage-full':'جبنه قريش جبنة قريش فلاحي',
    'ref:cottage-light':'جبنه قريش لايت',
    'ref:chicken-breast':'فراخ دجاج صدر فرخة فراخ مشوي صدور',
    'ref:chicken-thigh':'فراخ دجاج وراك فخدة',
    'ref:chicken-whole':'نص فرخة ربع فرخة فراخ دجاج مشوي',
    'ref:cooked-rice':'رز ارز مصري مسلوق مطبوخ',
    'ref:basmati':'رز بسمتي',
    'ref:potato':'بطاطس بطاطا افرنجي مسلوق',
    'ref:sweet-potato':'بطاطا حلوة بطاطا مشويه',
    'ref:tuna-water':'تونه تونة بالمية',
    'ref:tuna-oil':'تونه تونة بالزيت',
    'ref:bread-baladi':'عيش بلدى رغيف بلدي خبز مصري',
    'ref:balila':'بليله قمح',
    'ref:peanut-butter':'زبدة الفول السوداني',
    'ref:minced-beef':'لحمه مفرومه عصاج'
  };

  const byId = new Map(CATALOG.map(x => [x.id, x]));
  let external = [];
  let query = '';
  let grams = 100;
  let selected = null;
  let meal = 'breakfast';
  let editingId = null;
  let barcodeBusy = false;
  let busy = false;
  let lastOnlineSearch = 0;
  let feedback = '';
  let resultQuery = '';
  const searchCache = new Map();
  const externalDelay = 7000; // Explicit search only; respect Open Food Facts's search rate limits.

  const escape = v => E(v ?? '');
  const f = (value, digits = 0) => typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('ar-EG', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
  const numberOrNull = x => x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x);
  const clean = s => String(s || '').trim().toLocaleLowerCase('en').replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/\s+/g,' ');
  const latinDigits = s => String(s).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  const FOOD_FIELDS = ['calories','protein','carbs','fat','satfat'];
  function parseQuery(value) {
    const text = latinDigits(value).trim();
    const match = text.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(?:جم|جرام|غرام|غ|g|grams?)\s+(.+)$/i);
    if (match) {
      const quantity = Number(match[1].replace(',', '.'));
      return { term: match[2].trim(), quantity: quantity > 0 && quantity <= 10000 ? quantity : null };
    }
    return { term: text, quantity: null };
  }
  function customFoods(){
    if(typeof state==='undefined'||!Array.isArray(state.rows))return [];
    return state.rows.filter(x=>x.collection==='food-custom'&&x.data?.name)
      .map(row=>({...row.data,id:'custom:'+row.id,source:'custom',
        note:'قيم أدخلتها بنفسك من الملصق أو الوصفة. تأكد من الكمية ووحدة المرجع.'}));
  }
  function recentFoods(){
    if(typeof state==='undefined'||!Array.isArray(state.rows))return [];
    const rows=state.rows.filter(x=>x.collection==='food'&&x.data?.name).slice().sort((a,b)=>
      String(b.updatedAt||b.date||'').localeCompare(String(a.updatedAt||a.date||'')));
    const seen=new Set(),list=[];
    for(const row of rows){
      const d=row.data,id=String(d.foodId||d.name);
      if(seen.has(id))continue;
      seen.add(id);
      list.push({id:'recent:'+row.id,originalId:d.foodId,name:d.name,en:'',kcal:d.calories,
        protein:d.protein,carbs:d.carbs,fat:d.fat,satfat:d.satfat,
        source:d.foodSource||'recent',brand:'',note:d.foodNote||'من سجل أكل سابق؛ راجع حالة التسوية والكمية.'});
      if(list.length>=8)break;
    }
    return list;
  }
  function allFoods(){return [...customFoods(),...CATALOG]}
  function localMatches(search){
    const q=clean(search),foods=allFoods();
    if(!q)return [...customFoods().slice(0,5),...CATALOG.slice(0,12)];
    const terms=q.split(/\s+/).filter(Boolean);
    const scored=foods.map(item=>{
      const haystack=clean([item.name,item.en,SEARCH_ALIASES[item.id]||''].join(' '));
      if(!terms.every(term=>haystack.includes(term)))return null;
      const name=clean(item.name);
      const score=(name===q?100:0)+(name.startsWith(q)?30:0)+(item.source==='custom'?15:0);
      return {item,score};
    }).filter(Boolean).sort((a,b)=>b.score-a.score);
    return scored.slice(0,22).map(x=>x.item);
  }
  function mealInfo(id) { return MEALS.find(m => m.id === id) || MEALS[4]; }
  function mealOptions(chosen, includeUnsorted = false) {
    return MEALS.filter(x => includeUnsorted || x.id !== 'unsorted').map(m => `<option value="${m.id}" ${m.id === chosen ? 'selected' : ''}>${m.label}</option>`).join('');
  }
  function calc(food, amount) {
    const ratio = Number(amount) / 100;
    const calculated = {};
    for (const key of FOOD_FIELDS) calculated[key] = numberOrNull(key === 'calories' ? food?.kcal : food?.[key]) === null ? null : numberOrNull(key === 'calories' ? food.kcal : food[key]) * ratio;
    calculated.unsat = calculated.fat !== null && calculated.satfat !== null ? Math.max(0, calculated.fat - calculated.satfat) : null;
    return calculated;
  }
  function nutrientValue(entry, key) {
    const d = entry.data || {};
    if (key === 'fat') {
      const direct = numberOrNull(d.fat);
      if (direct !== null) return direct;
      // Backwards-compatible total fat where every legacy fat field was populated.
      const parts = [d.satfat,d.unsatfat,d.otherfat].map(numberOrNull);
      return parts.every(v => v !== null) ? parts.reduce((a,b)=>a+b,0) : null;
    }
    return numberOrNull(d[key]);
  }
  function totals(entries) {
    const sum = { calories:0,protein:0,carbs:0,fat:0,satfat:0,unsat:0 };
    const unknown = { calories:0,protein:0,carbs:0,fat:0,satfat:0,unsat:0 };
    for (const r of entries) {
      const factor = Math.max(0,Number(r.data.grams) || 0) / 100;
      for (const key of ['calories','protein','carbs','fat','satfat']) {
        const v = nutrientValue(r,key);
        if (v === null) unknown[key]++;
        else sum[key] += v * factor;
      }
      const d = r.data || {};
      let unsat = numberOrNull(d.unsatfat);
      if (unsat === null) {
        const fat = nutrientValue(r,'fat'), sat = numberOrNull(d.satfat);
        unsat = fat !== null && sat !== null ? Math.max(0,fat-sat) : null;
      }
      if (unsat === null) unknown.unsat++;
      else sum.unsat += unsat * factor;
    }
    return { sum, unknown, rows: entries.length };
  }
  function formatTotal(data,key,decimal=0) {
    return f(data.sum[key],decimal) + (data.unknown[key] ? '<span class="nutrition-estimated" title="فيه سجل ناقص القيمة دي">*</span>' : '');
  }
  function dataFromFood(food, amount, mealId) {
    const fat = numberOrNull(food.fat), sat = numberOrNull(food.satfat);
    return {
      name: food.name, grams: Number(amount), meal:mealId,
      calories: numberOrNull(food.kcal),protein:numberOrNull(food.protein),
      carbs:numberOrNull(food.carbs),fat,
      satfat: sat,
      unsatfat:fat !== null && sat !== null ? Math.max(0,fat-sat) : null,
      otherfat: null,
      foodSource:food.source,foodId:food.id,foodNote:food.note||'',sourceCode:food.code||''
    };
  }
  function recordSource(row) {
    const source = row.data.foodSource;
    if (source === 'openfoodfacts') return '<span class="nutrition-source remote">Open Food Facts</span>';
    if (source === 'reference') return '<span class="nutrition-source">قيمة تقريبية</span>';
    if (source === 'custom') return '<span class="nutrition-source custom">من أطعمتك</span>';
    return '<span class="nutrition-source legacy">سجل قديم</span>';
  }
  function renderMeal(r, info) {
    const d = r.data, itemTotals = totals([r]);
    return `<div class="nutrition-log-item"><div class="nutrition-log-main"><strong>${escape(d.name || 'صنف بدون اسم')}</strong><div class="nutrition-item-desc">${f(numberOrNull(d.grams),0)} جم · ${recordSource(r)}</div></div><div class="nutrition-log-macros"><strong>${formatTotal(itemTotals,'calories')} <small>سعر</small></strong><span>${formatTotal(itemTotals,'protein',1)} بروتين · ${formatTotal(itemTotals,'carbs',1)} كارب · ${formatTotal(itemTotals,'fat',1)} دهون</span></div><div class="nutrition-record-actions"><button type="button" class="btn sm" data-action="nutrition-edit" data-id="${escape(r.id)}" aria-label="تعديل ${escape(d.name)}">تعديل</button><button type="button" class="btn sm warn" data-action="delete" data-id="${escape(r.id)}" aria-label="حذف ${escape(d.name)}">حذف</button></div></div>`;
  }
  function foodCard(item) {
    const cal = numberOrNull(item.kcal), p = numberOrNull(item.protein);
    const badge = item.source === 'reference' ? 'صنف عام · تقريبي' : item.source === 'custom' ? 'أنت ضفته · بياناتك' : item.source === 'recent' ? 'من سجلاتك السابقة' : 'منتج · قاعدة بيانات مجتمعية';
    return `<button type="button" class="nutrition-result" data-action="nutrition-select" data-id="${escape(item.id)}"><span class="nutrition-result-title"><strong>${escape(item.name)}</strong><small>${escape(badge)}${item.brand ? ' · ' + escape(item.brand) : ''}</small></span><span class="nutrition-result-numbers">${f(cal)} <small>سعر / 100جم</small><small>${f(p,1)} جم بروتين</small></span></button>`;
  }
  function resultsHtml() {
    const local = localMatches(resultQuery);
    const common = local.map(foodCard).join('');
    const online = external.map(foodCard).join('');
    const hint = resultQuery ? (local.length ? '' : '<p class="hint">ملقيناش الصنف محليًا. جرّب بحث المنتجات أو الباركود، ولو مش موجود احفظه من بطاقة العبوة.</p>') : '<p class="hint">ابحث باسم الأكل أو اختار من الأطعمة الشائعة. تقدر تحفظ منتجاتك الخاصة كمان.</p>';
    return `<div class="nutrition-result-heading"><strong>${resultQuery?'نتائج على جهازك':'أطعمة شائعة وأطعمتك'}</strong><span>${local.length} نتيجة</span></div>${hint}<div class="nutrition-result-list">${common}</div>${external.length?`<div class="nutrition-result-heading"><strong>منتجات Open Food Facts</strong><span>${external.length} منتج</span></div><div class="nutrition-result-list">${online}</div>`:''}`;
  }
  function recentHtml(){
    const recent=recentFoods();
    return recent.length?`<section class="nutrition-recent"><div class="nutrition-result-heading"><strong>سجلتهم قبل كده</strong><span>إضافة سريعة</span></div><div class="nutrition-recent-list">${recent.map(food=>`<button type="button" class="nutrition-recent-chip" data-action="nutrition-select" data-id="${escape(food.id)}">${escape(food.name)}</button>`).join('')}</div></section>`:'';
  }
  function barcodeHtml(){
    return `<section class="nutrition-barcode-panel">
     <div class="nutrition-result-heading"><strong>منتج من السوبر ماركت؟</strong><span>بالباركود</span></div>
     <p class="hint">اكتب رقم الباركود الموجود على العبوة، أو جرّب تصويره لو المتصفح بيدعم قراءة الباركود من الصور.</p>
     <form data-form="nutrition-barcode" class="nutrition-barcode-form">
       <label class="nutrition-search-label" for="nutrition-barcode-code"><span>رقم الباركود</span><input id="nutrition-barcode-code" name="code" inputmode="numeric" pattern="[0-9٠-٩۰-۹ ]{8,18}" autocomplete="off" placeholder="مثال: 3017620422003" required></label>
       <button class="btn" type="submit" ${barcodeBusy?'disabled':''}>${barcodeBusy?'بندور...':'ابحث بالرقم'}</button>
     </form>
     <label class="nutrition-photo-barcode-btn" for="nutrition-barcode-photo"><span aria-hidden="true">▧</span> صوّر الباركود</label>
     <input type="file" id="nutrition-barcode-photo" accept="image/*" capture="environment" class="nutrition-file-input" aria-describedby="nutrition-barcode-tip">
     <small id="nutrition-barcode-tip">قراءة الصورة بتتم على جهازك لو المتصفح بيدعمها. لو مش مدعومة، اكتب الرقم يدويًا. تصوير الطبق وحده مش بيحدد السعرات بدقة.</small>
    </section>`;
  }
  function customHtml(){
    const foods=customFoods();
    return `<details class="nutrition-custom-panel"><summary><span>＋ أضف صنف مش موجود</span><small>من بطاقة المنتج أو معلومة موثوقة</small></summary>
     <p class="hint">القيم اللي هتكتبها هتتحفظ في حسابك وتظهر في البحث بعد كده. اكتب الرقم المدوّن للـ100 جم، أو غيّر وزن الحصة المكتوب على العبوة.</p>
     <form data-form="nutrition-custom" class="nutrition-custom-form">
      <div class="field nutrition-custom-wide"><label for="nutrition-custom-name">اسم الصنف أو البراند</label><input id="nutrition-custom-name" name="name" type="text" maxlength="100" placeholder="مثال: زبادي سادة من الشركة ..." required></div>
      <div class="nutrition-custom-grid">
       <div class="field"><label for="nutrition-custom-basis">القيم لكل كام جرام؟</label><input id="nutrition-custom-basis" name="basis" type="number" min="1" max="10000" step="any" value="100" required></div>
       <div class="field"><label for="nutrition-custom-prep">حالة الأكل</label><select id="nutrition-custom-prep" name="prep"><option value="packaged">منتج معبأ / بطاقة غذائية</option><option value="cooked">مطبوخ</option><option value="raw">نيّ</option><option value="unknown">مش محدد</option></select></div>
       <div class="field"><label for="nutrition-custom-kcal">السعرات على الملصق</label><input id="nutrition-custom-kcal" name="kcal" type="number" min="0" max="10000" step="any" placeholder="مثال: 130" required></div>
       <div class="field"><label for="nutrition-custom-protein">البروتين (جم) — اختياري</label><input id="nutrition-custom-protein" name="protein" type="number" min="0" max="1000" step="any" placeholder="—"></div>
       <div class="field"><label for="nutrition-custom-carbs">الكارب (جم) — اختياري</label><input id="nutrition-custom-carbs" name="carbs" type="number" min="0" max="1000" step="any" placeholder="—"></div>
       <div class="field"><label for="nutrition-custom-fat">الدهون (جم) — اختياري</label><input id="nutrition-custom-fat" name="fat" type="number" min="0" max="1000" step="any" placeholder="—"></div>
       <div class="field"><label for="nutrition-custom-satfat">دهون مشبعة (جم) — اختياري</label><input id="nutrition-custom-satfat" name="satfat" type="number" min="0" max="1000" step="any" placeholder="—"></div>
      </div>
      <button class="btn primary" type="submit">احفظ الصنف واستخدمه</button>
     </form>
     ${foods.length?`<div class="nutrition-custom-saved"><strong>أطعمتك المحفوظة (${foods.length})</strong><div class="nutrition-recent-list">${foods.slice(0,20).map(food=>`<button type="button" class="nutrition-recent-chip" data-action="nutrition-select" data-id="${escape(food.id)}">${escape(food.name)}</button>`).join('')}</div></div>`:''}
    </details>`;
  }
  function previewHtml(item, amount) {
    if (!item) return '';
    const v = calc(item,amount);
    const marker = item.source === 'reference' ? '<span class="nutrition-source">تقريبي</span>' : item.source === 'custom' ? '<span class="nutrition-source custom">بياناتك</span>' : '<span class="nutrition-source remote">منتج</span>';
    return `<div class="nutrition-preview-head"><strong>${escape(item.name)}</strong>${marker}</div><div class="nutrition-preview-grid"><div><strong>${f(v.calories)}</strong><small>سعر حراري</small></div><div><strong>${f(v.protein,1)}</strong><small>بروتين (جم)</small></div><div><strong>${f(v.carbs,1)}</strong><small>كارب (جم)</small></div><div><strong>${f(v.fat,1)}</strong><small>دهون (جم)</small></div></div><p class="hint">مشبع: ${f(v.satfat,1)} جم · غير مشبع (حساب تقريبي): ${f(v.unsat,1)} جم. ${escape(item.note || 'النتيجة تعتمد على بطاقة المنتج؛ راجع الملصق الغذائي.')}</p>`;
  }
  function view() {
    const todayRows = onDate('food');
    const summary = totals(todayRows);
    const mealGroups = MEALS.map(m => {
      const records = todayRows.filter(r => mealInfo(r.data.meal).id === m.id);
      const sub = totals(records);
      return `<section class="nutrition-meal-card"><div class="nutrition-meal-heading"><div class="nutrition-meal-icon ${m.color}">${m.icon}</div><div><h3>${m.label}</h3><small>${records.length} أصناف مسجلة</small></div><div class="nutrition-meal-cal">${f(sub.sum.calories)} <small>سعر</small></div></div>${records.length?`<div class="nutrition-items">${records.map(r=>renderMeal(r,m)).join('')}</div>`:'<div class="nutrition-empty-meal">مفيش أكل متسجل هنا لليوم ده.</div>'}</section>`;
    }).filter((markup,index) => index !== 4 || todayRows.some(r => mealInfo(r.data.meal).id === 'unsorted')).join('');
    const totalMacros = summary.sum.protein*4+summary.sum.carbs*4+summary.sum.fat*9;
    const p = totalMacros>0 ? Math.max(0,Math.min(100,summary.sum.protein*4/totalMacros*100)) : 0;
    const c = totalMacros>0 ? Math.max(0,Math.min(100,summary.sum.carbs*4/totalMacros*100)) : 0;
    const t = totalMacros>0 ? Math.max(0,Math.min(100,summary.sum.fat*9/totalMacros*100)) : 0;
    const incomplete = Object.entries(summary.unknown).filter(([key,count])=>count&&['calories','protein','carbs','fat'].includes(key)).length>0;
    return `<div class="nutrition-v2">
      <div class="nutrition-topline"><div><div class="eyebrow">FOOD JOURNAL / التغذية</div><h2>يومك الغذائي، بصورة أوضح</h2><p>اختار الأكل والكمية، والحساب يتم تلقائيًا. التاريخ الحالي: <strong>${escape(state.date)}</strong>.</p></div><span class="nutrition-live-label">محفوظ على جهازك</span></div>
      <section class="nutrition-totals" aria-label="حصيلة اليوم الغذائية"><div class="nutrition-total primary"><span>السعرات المسجلة</span><strong>${formatTotal(summary,'calories')}</strong><small>سعر حراري</small></div><div class="nutrition-total"><span>البروتين</span><strong>${formatTotal(summary,'protein',1)}</strong><small>جرام</small></div><div class="nutrition-total"><span>الكاربوهيدرات</span><strong>${formatTotal(summary,'carbs',1)}</strong><small>جرام</small></div><div class="nutrition-total"><span>الدهون الكلية</span><strong>${formatTotal(summary,'fat',1)}</strong><small>جرام</small></div></section>
      <section class="nutrition-distribution"><div class="nutrition-distribution-head"><div><strong>توزيع الماكروز المسجلة</strong><p>معلومة عن سجلاتك، مش هدف أو حد يومي.</p></div><div class="nutrition-fat-detail">دهون مشبعة: ${formatTotal(summary,'satfat',1)} جم · غير مشبعة تقديريًا: ${formatTotal(summary,'unsat',1)} جم</div></div><div class="nutrition-macro-track" role="img" aria-label="البروتين والكارب والدهون كنسبة من الطاقة المحسوبة للماكروز"><span class="protein" style="width:${p}%"></span><span class="carbs" style="width:${c}%"></span><span class="fat" style="width:${t}%"></span></div><div class="nutrition-macro-legend"><span><i class="protein"></i> بروتين</span><span><i class="carbs"></i> كارب</span><span><i class="fat"></i> دهون</span></div>${incomplete?'<p class="nutrition-note">* فيه سجلات ناقصة بيانات غذائية؛ الإجمالي الظاهر جزئي ومش معناه إن القيمة الناقصة صفر.</p>':''}</section>
      <section class="nutrition-add-panel" aria-labelledby="nutrition-add-heading"><div class="nutrition-section-head"><div><h3 id="nutrition-add-heading">أضف صنفًا في ثواني</h3><p>ابحث بالعربي أو الإنجليزي؛ مثال: «100جم جبنة قريش كامل الدسم».</p></div></div><div class="nutrition-search-row"><label class="nutrition-search-label" for="nutrition-food-search"><span>اسم الأكل</span><input type="search" id="nutrition-food-search" value="${escape(query)}" autocomplete="off" placeholder="جبنة قريش، بطاطس، أرز..." /></label><button type="button" class="btn" data-action="nutrition-search-online" ${busy?'disabled':''}>${busy?'جارٍ البحث...':'بحث منتجات أونلاين'}</button></div><p class="nutrition-source-hint">القائمة الشائعة تعمل Offline. زر البحث يرسل <strong>اسم الصنف فقط</strong> إلى Open Food Facts؛ لا تُرسل سجلاتك الشخصية.</p><div class="nutrition-search-feedback" role="status" aria-live="polite">${escape(feedback)}</div><div id="nutrition-food-results">${resultsHtml()}</div>${recentHtml()}${barcodeHtml()}${customHtml()}
      ${selected?`<form data-form="nutrition-add" class="nutrition-entry-form"><div class="nutrition-fields"><div class="field"><label for="nutrition-grams">الكمية بالجرام</label><input type="number" min="1" max="10000" step="any" id="nutrition-grams" name="grams" required value="${escape(grams)}"></div><div class="field"><label for="nutrition-meal">الوجبة</label><select id="nutrition-meal" name="meal">${mealOptions(meal)}</select></div></div><div id="nutrition-preview">${previewHtml(selected,grams)}</div><div class="nutrition-form-actions"><button class="btn primary" type="submit">أضف إلى اليوم</button><button class="btn" type="button" data-action="nutrition-clear">تغيير الصنف</button></div></form>`:'<div class="nutrition-select-hint">اختار صنف من النتائج عشان تشوف قيمته حسب الكمية.</div>'}</section>
      <div class="nutrition-section-head nutrition-diary-title"><div><h3>الوجبات اللي سجلتها النهارده</h3><p>تقدر تعدّل الكمية والوجبة والتاريخ لأي صنف، من غير ما تعمل سجل مكرر.</p></div><strong>${todayRows.length} أصناف</strong></div><div class="nutrition-meals">${mealGroups}</div>
      <div class="nutrition-bottom-note">قيم الأصناف العامة تقريبية؛ وزن الطعام بعد التسوية أو قبلها يغيّر الحساب، والمنتجات المختلفة ممكن تختلف. <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a> مصدر مجاني بترخيص <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL</a>. الحسابات للتوثيق والمعلومات فقط، مش لتحديد احتياج شخصي.</div>
      ${editor()}</div>`;
  }
  function editor() {
    const rec = state.rows.find(r => r.id === editingId && r.collection === 'food');
    if (!rec) return '';
    const d = rec.data;
    const subtotal = totals([rec]);
    return `<div class="nutrition-modal-backdrop" data-action="nutrition-close-edit"><section class="nutrition-modal" role="dialog" aria-modal="true" aria-labelledby="nutrition-edit-title"><div class="nutrition-section-head"><div><h3 id="nutrition-edit-title">تعديل الصنف</h3><p>${escape(d.name)}</p></div><button class="btn sm" type="button" data-action="nutrition-close-edit">إغلاق</button></div><form data-form="nutrition-edit" data-id="${escape(rec.id)}"><div class="nutrition-fields"><div class="field"><label for="nutrition-edit-grams">الكمية (جم)</label><input id="nutrition-edit-grams" type="number" min="1" max="10000" step="any" value="${escape(d.grams)}" name="grams" required></div><div class="field"><label for="nutrition-edit-meal">الوجبة</label><select id="nutrition-edit-meal" name="meal">${mealOptions(d.meal||'unsorted',true)}</select></div><div class="field"><label for="nutrition-edit-date">التاريخ</label><input id="nutrition-edit-date" name="date" type="date" value="${escape(rec.date)}" required></div></div><p class="nutrition-note">القيم الغذائية لكل 100 جم محفوظة مع السجل، وتتحسب تلقائيًا لما تغيّر الكمية. لتغيير الصنف نفسه احذف السجل واختار الصنف الصح.</p><div class="nutrition-form-actions"><button class="btn primary" type="submit">احفظ التعديل</button><button class="btn" type="button" data-action="nutrition-close-edit">إلغاء</button></div></form></section></div>`;
  }
  function normalizeProduct(p) {
    const nu = p.nutriments || {};
    const get = field => numberOrNull(nu[field + '_100g']);
    let kcal = get('energy-kcal');
    if (kcal === null) {
      const kilojoules = get('energy-kj');
      if (kilojoules !== null) kcal = kilojoules / 4.184;
    }
    const protein=get('proteins'), carbs=get('carbohydrates'), fat=get('fat'), satfat=get('saturated-fat');
    const name=String(p.product_name_ar||p.product_name||p.product_name_en||'').trim();
    const code=String(p.code||'').replace(/[^0-9]/g,'');
    if(!name||!code||![kcal,protein,carbs,fat].some(v=>v!==null))return null;
    if([kcal,protein,carbs,fat,satfat].some(v=>v!==null&&(v<0||v>2000)))return null;
    if([protein,carbs,fat,satfat].some(v=>v!==null&&v>100))return null;
    const missing=['calories','protein','carbs','fat'].filter((key,i)=>[kcal,protein,carbs,fat][i]===null);
    return {id:'off:'+code,name:name.slice(0,140),brand:String(p.brands||'').slice(0,110),en:'',
      kcal,protein,carbs,fat,satfat,code,source:'openfoodfacts',incomplete:missing.length>0,
      note: missing.length?'منتج موجود لكن فيه قيم غذائية ناقصة في المصدر. الخانات الفاضية مش صفر. راجع بطاقة العبوة.':'قيم من قاعدة بيانات مجتمعية، راجع بطاقة العبوة.'};
  }
  function setInput(value) {
    query = String(value).slice(0,150);
    const parsed = parseQuery(query);
    if (parsed.quantity !== null) grams = parsed.quantity;
    resultQuery = parsed.term;
    external = [];
    feedback = '';
    const holder = document.getElementById('nutrition-food-results');
    if (holder) holder.innerHTML = resultsHtml();
    const status = document.querySelector('.nutrition-search-feedback');
    if (status) status.textContent = '';
  }
  function select(id) {
    const product = byId.get(id) || customFoods().find(x=>x.id === id) || recentFoods().find(x=>x.id===id) || external.find(x=>x.id === id);
    if(!product) { feedback='الصنف مش متاح حاليًا. جرّب تختاره مرة تانية.'; render(); return; }
    selected = product;
    render();
    document.getElementById('nutrition-grams')?.focus();
  }
  async function searchOnline() {
    const input = document.getElementById('nutrition-food-search');
    const term = parseQuery(input?.value||query).term;
    if (term.length < 3) {feedback='اكتب 3 حروف على الأقل عشان نبحث.';render();return;}
    if (busy) return;
    if (searchCache.has(clean(term))) {external=searchCache.get(clean(term));feedback=external.length?'نتائج محفوظة من البحث السابق.':'مفيش منتجات مناسبة في نتيجة البحث السابقة.';render();return;}
    const now=Date.now();
    if (now-lastOnlineSearch < externalDelay) {feedback='استنى ثواني قبل ما تبحث مرة تانية؛ المصدر المجاني بيحد عدد الطلبات.';render();return;}
    if(typeof fetch !== 'function') {feedback='البحث أونلاين مش متاح في المتصفح ده.';render();return;}
    busy=true;lastOnlineSearch=now;feedback='جاري البحث في المنتجات...';render();
    try {
      const url='https://world.openfoodfacts.org/cgi/search.pl?'+new URLSearchParams({search_terms:term,search_simple:'1',action:'process',json:'1',page_size:'45',fields:'code,product_name,product_name_ar,product_name_en,brands,nutriments'}).toString();
      const response=await fetch(url,{method:'GET',headers:{'Accept':'application/json'}});
      if(!response.ok) throw new Error(response.status===429?'المصدر مشغول حاليًا؛ جرّب بعد شوية.':'تعذر الاتصال بالمصدر المجاني.');
      const payload=await response.json();
      if(!Array.isArray(payload.products))throw new Error('استجابة المصدر غير صالحة.');
      external=payload.products.map(normalizeProduct).filter(Boolean).slice(0,25);
      searchCache.set(clean(term),external);
      feedback=external.length?'راجع تفاصيل المنتج قبل إضافته. القيم الناقصة بتظهر كشرطة —، مش صفر.':'ملقيناش منتج مناسب بالاسم. جرّب الباركود أو احفظ صنف جديد من بطاقة العبوة.';
    } catch(err) { external=[]; feedback='البحث أونلاين غير متاح دلوقتي. تقدر تستخدم الأطعمة الشائعة بدون إنترنت. '+(err instanceof Error?err.message:''); }
    finally {busy=false;render();}
  }
  function validateBarcode(value){
    const code=latinDigits(value).replace(/[\s-]/g,'');
    if(!/^[0-9]{8,14}$/.test(code))throw Error('اكتب باركود مكوّن من 8 إلى 14 رقم.');
    return code;
  }
  async function searchBarcode(value){
    const code=validateBarcode(value);
    const cached=searchCache.get('barcode:'+code);
    if(cached){selected=cached;external=[cached];resultQuery='';query=cached.name;feedback='لقينا المنتج من بحث سابق. راجع بياناته.';render();return cached}
    if(barcodeBusy)return null;
    if(typeof fetch!=='function')throw Error('البحث بالباركود يحتاج اتصال إنترنت.');
    barcodeBusy=true;feedback='بندور على المنتج برقم الباركود…';render();
    try{
      const url='https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(code)+'.json?'+new URLSearchParams({
        fields:'code,product_name,product_name_ar,product_name_en,brands,nutriments,quantity,serving_size'
      });
      const res=await fetch(url,{headers:{Accept:'application/json'}});
      if(!res.ok)throw Error('تعذر تحميل بيانات المنتج؛ جرب لاحقًا.');
      const payload=await res.json();
      if(payload.status!==1||!payload.product)throw Error('المنتج ده مش مسجّل في Open Food Facts. تقدر تضيفه من بيانات العبوة.');
      const food=normalizeProduct({...payload.product,code:payload.product.code||code});
      if(!food)throw Error('المنتج موجود لكن قيمه الغذائية غير متاحة. أضفه يدويًا من بطاقة العبوة.');
      searchCache.set('barcode:'+code,food);
      selected=food;external=[food];query=food.name;resultQuery='';
      feedback=food.incomplete?'لقينا المنتج، لكن فيه بيانات ناقصة. راجع الملصق قبل الاعتماد عليها.':'لقينا المنتج. راجع اسم العبوة والقيم قبل الإضافة.';
      return food;
    }catch(err){feedback=String(err.message||err);return null}
    finally{barcodeBusy=false;render()}
  }
  async function scanBarcodePhoto(input){
    const file=input?.files?.[0];
    if(!file)return;
    try{
      if(file.size>12*1024*1024)throw Error('اختار صورة أصغر من 12 ميجابايت.');
      if(typeof window==='undefined'||typeof window.BarcodeDetector!=='function'){
        throw Error('متصفحك لا يدعم قراءة الباركود من الصورة تلقائيًا. استخدم كاميرا الموبايل لقراءة الرقم أو اكتبه هنا.');
      }
      if(typeof createImageBitmap!=='function')throw Error('المتصفح لا يدعم تحليل الصورة محليًا. اكتب رقم الباركود بدلًا منها.');
      const bitmap=await createImageBitmap(file);
      let codes=[];
      try{
        const decoder=new window.BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128']});
        codes=await decoder.detect(bitmap);
      }finally{bitmap.close?.()}
      const raw=codes.map(x=>String(x.rawValue||'')).find(x=>/^\d{8,14}$/.test(x));
      if(!raw)throw Error('الصورة مش واضحة كفاية أو الباركود مش مدعوم. جرّب رقم العبوة يدويًا.');
      await searchBarcode(raw);
    }catch(err){feedback=String(err.message||err);render()}
    finally{input.value=''}
  }
  async function saveCustomFood(form){
    const fd=new FormData(form),name=String(fd.get('name')||'').trim(),basis=Number(fd.get('basis'));
    if(!name||name.length>100)throw Error('اكتب اسم صنف واضح في حدود 100 حرف.');
    if(!Number.isFinite(basis)||basis<=0||basis>10000)throw Error('راجع وزن الحصة المكتوب على الملصق.');
    if(customFoods().some(x=>clean(x.name)===clean(name)))throw Error('الصنف موجود في أطعمتك بالفعل؛ اختاره من البحث.');
    const get=(key,required=false)=>{
      const raw=String(fd.get(key)||'').trim().replace(',','.');
      if(!raw)return required?NaN:null;
      const val=Number(raw);
      return Number.isFinite(val)&&val>=0?val:NaN;
    };
    const calorie=get('kcal',true);
    if(!Number.isFinite(calorie)||calorie>10000)throw Error('راجع السعرات المكتوبة على بطاقة المنتج.');
    const fields=['protein','carbs','fat','satfat'];
    const vals=fields.map(key=>get(key));
    if(vals.some(v=>v!==null&&(!Number.isFinite(v)||v>basis)))throw Error('راجع القيم الغذائية ووزن الحصة.');
    if(vals[3]!==null&&vals[2]!==null&&vals[3]>vals[2])throw Error('الدهون المشبعة ما ينفعش تكون أعلى من الدهون الكلية.');
    const ratio=100/basis,prep=String(fd.get('prep')||'unknown');
    if(!['packaged','cooked','raw','unknown'].includes(prep))throw Error('اختار نوع الوزن.');
    const note='قيم حسب البيانات اللي كتبتها لكل '+basis+' جم؛ حالة الأكل: '+({packaged:'منتج معبأ',cooked:'مطبوخ',raw:'نيّ',unknown:'غير محددة'}[prep])+'. راجع الملصق عند اختلاف المنتج.';
    const food={name,kcal:calorie*ratio,protein:vals[0]===null?null:vals[0]*ratio,
      carbs:vals[1]===null?null:vals[1]*ratio,fat:vals[2]===null?null:vals[2]*ratio,
      satfat:vals[3]===null?null:vals[3]*ratio,prep,note,basis};
    if(food.kcal>1000||[food.protein,food.carbs,food.fat,food.satfat].some(v=>v!==null&&v>100.1))
      throw Error('القيم لكل 100 جم أعلى من المتوقع؛ راجع وزن الحصة والبيانات.');
    const id='food-custom-'+crypto.randomUUID();
    await save('food-custom',state.date,food,id);
    selected={...food,id:'custom:'+id,source:'custom'};
    query='';resultQuery='';feedback='';
    render();notice('الصنف اتحفظ في حسابك، وتقدر تختاره وتضيف الكمية.');
    return selected;
  }

  function handleInput(event) {
    const target=event.target;
    if(target?.id==='nutrition-food-search'){setInput(target.value);return;}
    if(target?.id==='nutrition-grams') {
      const parsed=Number(target.value);grams=Number.isFinite(parsed)?parsed:0;
      const p=document.getElementById('nutrition-preview');if(p)p.innerHTML=previewHtml(selected,grams);
    }
  }
  function edit(id) { const rec=state.rows.find(x=>x.id===id&&x.collection==='food');if(!rec)return;editingId=id;render();document.getElementById('nutrition-edit-grams')?.focus(); }
  function close() {editingId=null;render();}
  async function submit(form) {
    if(form.dataset.form==='nutrition-custom'){await saveCustomFood(form);return;}
    if(form.dataset.form==='nutrition-barcode'){await searchBarcode(new FormData(form).get('code'));return;}
    const d = new FormData(form);
    const amount=Number(d.get('grams'));
    const chosenMeal=String(d.get('meal')||'');
    if(!Number.isFinite(amount)||amount<=0||amount>10000)throw Error('اكتب وزنًا صحيحًا بالجرام.');
    if(!MEALS.some(x=>x.id===chosenMeal))throw Error('اختار الوجبة الصحيحة.');
    if(form.dataset.form==='nutrition-add'){
      if(!selected)throw Error('اختار الصنف الأول.');
      await save('food',state.date,dataFromFood(selected,amount,chosenMeal));
      meal=chosenMeal;selected=null;grams=100;render();notice('تمت إضافة الصنف إلى وجبتك.');
    } else if(form.dataset.form==='nutrition-edit') {
      const rec=state.rows.find(x=>x.id===form.dataset.id&&x.collection==='food');
      const date=String(d.get('date')||'');
      if(!rec)throw Error('السجل مش موجود.');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('راجع التاريخ.');
      await save('food',date,{...rec.data,grams:amount,meal:chosenMeal},rec.id);
      editingId=null;render();notice('تم تحديث الصنف من غير تكرار السجل.');
    }
  }
  async function action(name, el, target) {
    if(name==='nutrition-search-online') {await searchOnline();return;}
    if(name==='nutrition-select') {select(el.dataset.id);return;}
    if(name==='nutrition-clear') {selected=null;render();return;}
    if(name==='nutrition-edit') {edit(el.dataset.id);return;}
    if(name==='nutrition-close-edit') {
      if(el.classList.contains('nutrition-modal-backdrop') && el!==target) return;
      close();return;
    }
  }
  window.KhotwaNutrition={view,calc,totals,parseQuery,normalizeProduct,localMatches,handleInput,action,submit,edit,close,dataFromFood,mealInfo,customFoods,recentFoods,validateBarcode,searchBarcode,scanBarcodePhoto,saveCustomFood};
}());