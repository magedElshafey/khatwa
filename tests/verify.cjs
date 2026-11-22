const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const text=name=>fs.readFileSync(path.join(root,name),'utf8');
const ctx=vm.createContext({window:{},console,Date,Math,Number,String,Object,Array,Set,Map,Intl,crypto:{randomUUID:()=>"test"}});
vm.runInContext(text('roadmap-data.js'),ctx);
vm.runInContext(text('experience.js'),ctx);
vm.runInContext(text('nutrition.js'),ctx);
vm.runInContext(text('smoking-insights.js'),ctx);
const appPath=fs.existsSync(path.join(root,'dist','app.js'))?'dist/app.js':'app.js';
vm.runInContext(text(appPath).replace(/void boot\(\);\s*$/,''),ctx);
for(const fn of ['viewToday','viewLearning','viewEnglish','viewBusiness','viewSmoking','viewWorkout','viewNutrition','viewBody','viewSpiritual','viewRoutine','viewSleep','viewMoney','viewSocial','viewReview','viewSettings','viewMore']){
 let rendered=vm.runInContext(fn+'()',ctx);
 assert.equal(typeof rendered,'string');assert(rendered.length>300,fn+' rendered too little');
}
assert.equal(vm.runInContext('allSessions().length',ctx),144,'roadmap sessions changed');
// Appearance regression checks: default theme, interactive toggle, local preference and unchanged records.
assert(text('index.html').includes('data-theme="dark"'));
assert(text('index.html').includes('family=Cairo'));
assert(text('styles.css').includes("font-family:'Cairo'"));
assert(text('styles.css').includes('html[data-theme="dark"]'));
const themeWrites=[];
// The app's render() inspects details elements after the first theme change.
// Model the relevant DOM methods so repeated theme toggles are exercised without a real browser.
ctx.document={documentElement:{dataset:{theme:'dark'}},querySelector:()=>({setAttribute:()=>{}}),getElementById:()=>({innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null})};
ctx.localStorage={setItem:(k,v)=>themeWrites.push([k,v])};
assert.equal(vm.runInContext('isDarkTheme()',ctx),true);
vm.runInContext('changeTheme()',ctx);
assert.equal(ctx.document.documentElement.dataset.theme,'light');
assert.equal(themeWrites.at(-1)[0],'khotwa-theme');
assert.equal(themeWrites.at(-1)[1],'light');
vm.runInContext('changeTheme()',ctx);
assert.equal(ctx.document.documentElement.dataset.theme,'dark');
assert.equal(themeWrites.at(-1)[1],'dark');
assert(vm.runInContext('pageShell(viewToday())',ctx).includes('data-action="toggle-theme"'));
assert(vm.runInContext('viewSettings()',ctx).includes('الشكل والألوان'));
// Workout insights: per-exercise daily aggregation and chart/table availability.
const exerciseRows=[
 {date:'2026-11-01',data:{exercise:'Flat Bench Press',set:1,reps:8,weight:'20'}},
 {date:'2026-11-01',data:{exercise:' flat  bench  press ',set:2,reps:9,weight:'20'}},
 {date:'2026-11-09',data:{exercise:'Flat Bench Press',set:1,reps:7,weight:'22.5'}}
];
const sessionStats=ctx.window.KhotwaExperience.stats(exerciseRows);
assert.equal(sessionStats.length,2,'workout sessions must group by date');
assert.equal(sessionStats[0].volume,340,'session volume must add set volumes');
assert.equal(sessionStats[1].bestWeight,22.5,'top weight must come from the chosen exercise');
vm.runInContext("state.rows=[{id:'workout-abc',collection:'workout',date:'2026-11-01',data:{exercise:'Flat Bench Press',set:1,reps:8,weight:'20',notes:''}}]",ctx);
const workoutHtml=vm.runInContext('viewWorkout()',ctx);
assert(workoutHtml.includes('workout-exercise'),'exercise picker missing');
assert(workoutHtml.includes('رسم بياني')&&workoutHtml.includes('جدول المجموعات'),'workout view switch missing');
assert.equal(ctx.window.KhotwaExperience.editor(),'','editor should not show before an Edit action');

const nutrition=ctx.window.KhotwaNutrition;
assert(nutrition,'nutrition module not loaded');
assert.equal(nutrition.parseQuery('100جم جبنة قريش كامل الدسم').quantity,100,'quantity parsing');
const cheese=nutrition.localMatches('جبنة قريش كامل الدسم')[0];
assert(cheese,'Egyptian cottage cheese lookup missing');
assert.equal(nutrition.calc(cheese,100).calories,98,'100g calories not auto-calculated');
assert.equal(nutrition.calc(cheese,100).protein,11.1,'100g protein not auto-calculated');
assert.equal(nutrition.calc(cheese,150).calories,147,'portion scaling broken');
const foodData=nutrition.dataFromFood(cheese,100,'breakfast');
const dayFoods=[{id:'food-1',collection:'food',date:'2026-11-22',data:foodData}];
assert.equal(nutrition.totals(dayFoods).sum.protein,11.1,'daily protein total broken');
assert.equal(nutrition.totals(dayFoods).sum.fat,4.3,'daily fat total broken');
assert.equal(nutrition.totals(dayFoods.concat([{data:{grams:50,name:'legacy'},date:'2026-11-22'}])).unknown.fat,1,'missing legacy nutrients cannot be treated as zero');
assert(nutrition.normalizeProduct({code:'12345',product_name:'Demo',nutriments:{'energy-kcal_100g':200,'proteins_100g':10,'carbohydrates_100g':20,'fat_100g':8}}),'Open Food Facts normalization broken');
assert.equal(nutrition.normalizeProduct({code:'12345',product_name:'Incomplete',nutriments:{'energy-kcal_100g':200}}),null,'incomplete product must be rejected');
const nutritionHtml=vm.runInContext('viewNutrition()',ctx);
assert(nutritionHtml.includes('nutrition-food-search')&&nutritionHtml.includes('الإفطار'),'nutrition UI unavailable');
assert(text('index.html').includes('src="./nutrition.js"'),'nutrition script missing in entry');


const todayShell=vm.runInContext('pageShell(viewToday())',ctx);
assert(todayShell.includes('topbar-actions'),'header controls missing layout hook');
assert(todayShell.includes('id="global-date"'),'date field missing');
assert(!todayShell.includes('class="avatar"'),'decorative lock still visible');
assert(todayShell.includes('class="page-content"'),'page wrapper missing');
assert(vm.runInContext('viewToday()',ctx).includes('today-priority-grid'),'Today spacing missing');
assert(text('styles.css').includes('khotwa-page-enter'),'entry animation missing');
assert(text('styles.css').includes('prefers-reduced-motion:reduce'),'reduced motion not supported');
// Accordion regression: keep geometry stable and preserve the current open/closed state on render.
assert(text('styles.css').includes('scrollbar-gutter:stable'),'scrollbar can shift the page width');
assert(text('styles.css').includes('border-bottom:1px solid transparent'),'summary border is not reserved');
assert(text('styles.css').includes('.sprint>summary::marker'),'native details marker is not normalized');
assert(vm.runInContext('viewLearning()',ctx).includes('data-accordion-id="learning-'),'learning accordion IDs missing');
assert(vm.runInContext('viewBusiness()',ctx).includes('data-accordion-id="business-'),'business accordion IDs missing');
const beforeDetail={dataset:{accordionId:'learning-test'},open:false};
const afterDetail={dataset:{accordionId:'learning-test'},open:true};
const host={replaced:false,querySelectorAll(){return this.replaced?[afterDetail]:[beforeDetail];},querySelector(){return null;}};
Object.defineProperty(host,'innerHTML',{set(){this.replaced=true;}});
ctx.document.getElementById=()=>host;
vm.runInContext("state.page='learning';lastRenderedPage='learning';render()",ctx);
assert.equal(afterDetail.open,false,'accordion was reopened after a same-page render');


let out=vm.runInContext(`state.settings.smoking={avg:20,packSize:20,packPrice:100,start:'2026-11-20'};state.rows=[{id:'smoke-2026-11-20',collection:'smoking',date:'2026-11-20',data:{count:0},updatedAt:''},{id:'smoke-2026-11-21',collection:'smoking',date:'2026-11-21',data:{count:5},updatedAt:''},{id:'smoke-2026-11-19',collection:'smoking',date:'2026-11-19',data:{count:0},updatedAt:''}];smokeMath()`,ctx);
assert.equal(out.days,1);assert.equal(out.avoided,35);assert.equal(out.saved,175);
// A chosen quit hour makes its first date a partial day, not a full baseline day.
let partial=vm.runInContext("state.settings.smoking.quitAt='2026-11-20T15:30';smokeMath()",ctx);
assert.equal(partial.days,0,'partial start date must not be counted as a clean full day');
assert.equal(partial.avoided,15,'partial start date must not count estimated avoided cigarettes');
assert.equal(partial.saved,75,'partial day should not inflate estimated savings');
assert.equal(partial.eligible,1,'only complete logged days count in estimated totals');
const setupHtml=vm.runInContext("smokeEditing=true;viewSmoking()",ctx);
assert(setupHtml.includes('type="datetime-local"')&&setupHtml.includes('name="quitAt"'),'quit time picker is required');
vm.runInContext("smokeEditing=false",ctx);
assert(text('styles.css').includes('table td .btn + .btn'),'table actions need explicit gaps');
assert.doesNotThrow(()=>new vm.Script(text('app.js')),'tracked browser app.js has a syntax error');
assert.doesNotThrow(()=>new vm.Script(text('smoking-insights.js')),'milestone script has a syntax error');
assert.doesNotThrow(()=>new vm.Script(text('sw.js')),'service worker source has a syntax error');
const oldSpiritual=vm.runInContext("state.date='2026-11-22';state.rows=[{id:'spirit-2026-11-22',collection:'spiritual',date:'2026-11-22',data:{adhkar:true},updatedAt:''}];viewSpiritual()",ctx);
assert(oldSpiritual.includes('أذكار الصباح')&&oldSpiritual.includes('أذكار المساء'),'separate adhkar missing');
assert(!oldSpiritual.includes('data-spirit="adhkar"'),'combined checkbox must be removed');
assert(oldSpiritual.includes('تسجيل أذكار قديم غير مقسّم'),'historic adhkar must be preserved without guessing');
assert(oldSpiritual.includes('0 / 9'),'legacy check cannot be silently counted as both new options');
const sleepHtml=vm.runInContext("viewSleep()",ctx);
assert(sleepHtml.includes('data-sleep="screen"'),'bedtime checklist not available');
assert(sleepHtml.includes('data-form="sleep-add"'),'bedtime routine must be customizable');
assert(sleepHtml.includes('sleep-rename')&&sleepHtml.includes('sleep-remove'),'bedtime items must be editable');
const bedtimeIds=vm.runInContext('sleepSteps().map(x=>x.id)',ctx);
assert.equal(new Set(bedtimeIds).size,bedtimeIds.length,'routine steps require stable unique IDs');
assert(vm.runInContext("pageShell(viewSleep())",ctx).includes('روتين قبل النوم'),'bedtime module navigation missing');


const insights=ctx.window.KhotwaSmokeInsights;
assert(insights,'smoking insights helper not available');
const since=Date.parse('2026-11-20T09:00:00');
const quitConfig={avg:20,packSize:20,packPrice:100,quitAt:'2026-11-20T09:00',start:'2026-11-20'};
const twentyOne=insights.estimate(quitConfig,since+21*60*60*1000);
assert.equal(twentyOne.valid,true);
assert.equal(twentyOne.cigarettes,18,'21 hours at 20/day should yield ~18 potential cigarettes');
assert.equal(twentyOne.money,87.5,'time-proportional potential savings incorrect');
assert.equal(twentyOne.reached.at(-1).hours,8,'8-hour milestone should be the latest after 21h');
assert.equal(twentyOne.next.hours,48,'taste and smell is the next milestone after 21h');
assert(insights.timeline(quitConfig,since+21*3600000).includes('المصدر: NHS'),'health timeline needs linked evidence');
assert(insights.timeline(quitConfig,since+21*3600000).includes('المصدر: CDC'),'timeline must cite CDC');
assert.equal(insights.estimate({...quitConfig,quitAt:'2026-12-01T08:00'},since).cigarettes,0,'future quit date should not create savings');
assert.equal(insights.estimate({avg:20,start:'2026-11-20'},since).valid,false,'date-only config should not invent a timestamp');
assert(text('scripts/build.cjs').includes("'smoking-insights.js'"),'Vercel must publish smoking insights JS');
assert(text('sw.js').includes("'./smoking-insights.js'"),'PWA must cache smoking insights');
let smokingScreen=vm.runInContext("state.settings.smoking={avg:20,packSize:20,packPrice:100,start:'2026-11-20',quitAt:'2026-11-20T09:00'};smokeEditing=false;viewSmoking()",ctx);
assert(smokingScreen.includes('رحلة مبنية على العلم'),'health section missing from smoking screen');
assert(smokingScreen.includes('بافتراض إنك ما دخّنتش'),'potential estimate must include disclaimer');

let nu=vm.runInContext(`nutritionTotals([{data:{grams:200,calories:100,protein:5,carbs:20,satfat:1,unsatfat:2,otherfat:0}}])`,ctx);
assert.equal(nu.calories,200);assert.equal(nu.protein,10);assert.equal(nu.carbs,40);
for(const f of ['index.html','styles.css','experience.js','nutrition.js','smoking-insights.js','app.js','roadmap-data.js','sw.js','manifest.webmanifest','assets/icon-192.png','assets/icon-512.png'])assert(fs.existsSync(path.join(root,f)),`missing ${f}`);
const m=JSON.parse(text('manifest.webmanifest'));assert(m.icons?.length>=2);
console.log('✓ 16 views rendered, 144 learning units loaded, smoking/nutrition math correct, PWA assets present.');
console.log('Note: Browser-based visual/offline interaction testing must still be done after HTTPS deployment.');
