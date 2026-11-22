const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const text=name=>fs.readFileSync(path.join(root,name),'utf8');
const ctx=vm.createContext({window:{},console,Date,Math,Number,String,Object,Array,Set,Map,Intl,crypto:{randomUUID:()=>"test"}});
vm.runInContext(text('roadmap-data.js'),ctx);
const appPath=fs.existsSync(path.join(root,'dist','app.js'))?'dist/app.js':'app.js';
vm.runInContext(text(appPath).replace(/void boot\(\);\s*$/,''),ctx);
for(const fn of ['viewToday','viewLearning','viewEnglish','viewBusiness','viewSmoking','viewWorkout','viewNutrition','viewBody','viewSpiritual','viewRoutine','viewMoney','viewSocial','viewReview','viewSettings','viewMore']){
 let rendered=vm.runInContext(fn+'()',ctx);
 assert.equal(typeof rendered,'string');assert(rendered.length>300,fn+' rendered too little');
}
assert.equal(vm.runInContext('allSessions().length',ctx),144,'roadmap sessions changed');
let out=vm.runInContext(`state.settings.smoking={avg:20,packSize:20,packPrice:100,start:'2026-11-20'};state.rows=[{id:'smoke-2026-11-20',collection:'smoking',date:'2026-11-20',data:{count:0},updatedAt:''},{id:'smoke-2026-11-21',collection:'smoking',date:'2026-11-21',data:{count:5},updatedAt:''},{id:'smoke-2026-11-19',collection:'smoking',date:'2026-11-19',data:{count:0},updatedAt:''}];smokeMath()`,ctx);
assert.equal(out.days,1);assert.equal(out.avoided,35);assert.equal(out.saved,175);
let nu=vm.runInContext(`nutritionTotals([{data:{grams:200,calories:100,protein:5,carbs:20,satfat:1,unsatfat:2,otherfat:0}}])`,ctx);
assert.equal(nu.calories,200);assert.equal(nu.protein,10);assert.equal(nu.carbs,40);
for(const f of ['index.html','styles.css','app.js','roadmap-data.js','sw.js','manifest.webmanifest','assets/icon-192.png','assets/icon-512.png'])assert(fs.existsSync(path.join(root,f)),`missing ${f}`);
const m=JSON.parse(text('manifest.webmanifest'));assert(m.icons?.length>=2);
console.log('✓ 15 views rendered, 144 learning units loaded, smoking/nutrition math correct, PWA assets present.');
console.log('Note: Browser-based visual/offline interaction testing must still be done after HTTPS deployment.');
