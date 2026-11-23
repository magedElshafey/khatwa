// Offline nutrition discovery and barcode workflow tests: no real user data or uploads.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../nutrition.js'),'utf8');
const state={date:'2026-11-23',rows:[]};
const written=[],notifications=[];
let renderCount=0;
let fetchCount=0;
let barcodeResult='found';
const mockedFetch=async(url)=>{
 fetchCount++;
 if(!url.includes('/api/v2/product/'))throw Error('unexpected online search route');
 if(barcodeResult==='missing')return {ok:true,json:async()=>({status:0})};
 return {ok:true,json:async()=>({status:1,product:{
  code:'3017620422003',product_name:'منتج تجريبي',
  brands:'Example Market',
  nutriments:{'energy-kcal_100g':230}
 }})};
};
class TestFormData{
 constructor(form){this.values=form.values||{}}
 get(key){return this.values[key]??null}
}
const ctx=vm.createContext({
 state,window:{},Date,Math,Number,String,Map,Set,Array,Object,console,
 E:value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),
 onDate:collection=>state.rows.filter(x=>x.collection===collection&&x.date===state.date),
 save:async(collection,date,data,id='id-'+(written.length+1))=>{
  const row={id,collection,date,data,updatedAt:new Date().toISOString()};
  state.rows=state.rows.filter(x=>x.id!==id).concat(row);written.push(row);return row;
 },
 FormData:TestFormData,crypto:{randomUUID:()=>String(written.length+1)},
 URLSearchParams,fetch:mockedFetch,
 notice:msg=>notifications.push(msg),render:()=>{renderCount++;},
 document:{getElementById:()=>null,querySelector:()=>null}
});
vm.runInContext(code,ctx);
const n=ctx.window.KhotwaNutrition;
(async()=>{
 assert(n.localMatches('فول').some(x=>x.id==='ref:ful'),'fava beans should be available without online search');
 assert(n.localMatches('فراخ').some(x=>x.id==='ref:chicken-breast'),'synonyms should find chicken');
 assert.equal(n.validateBarcode('٣٠١٧٦٢٠٤٢٢٠٠٣'),'3017620422003','Arabic numbers should work for product code');
 assert.throws(()=>n.validateBarcode('ABC123'),/باركود/);
 const custom={dataset:{form:'nutrition-custom'},values:{name:'منتج مصري من السوبر ماركت',basis:'50',prep:'packaged',kcal:'110',protein:'3',carbs:'18',fat:'2',satfat:'1'}};
 const selected=await n.saveCustomFood(custom);
 assert.equal(selected.kcal,220,'serving calories must convert to per 100g');
 assert.equal(selected.protein,6,'serving protein must convert to per 100g');
 assert.equal(selected.satfat,2,'serving saturated fat conversion must be correct');
 assert.equal(state.rows[0].collection,'food-custom','custom food should use a sync-compatible record');
 assert(n.localMatches('منتج مصري').some(x=>x.source==='custom'),'custom food should reappear in local search');
 assert(n.view().includes('منتج مصري من السوبر ماركت'),'custom food must be in the user interface');
 assert(notifications.length===1,'saved food should show confirmation');
 await assert.rejects(n.saveCustomFood(custom),/موجود/,'duplicate custom foods should be rejected');
 const invalid={dataset:{form:'nutrition-custom'},values:{...custom.values,name:'غير منطقي',basis:'20',fat:'21'}};
 await assert.rejects(n.saveCustomFood(invalid),/راجع/,'fat grams exceeding serving weight must be rejected');
 const product=await n.searchBarcode('3017620422003');
 assert.equal(product.name,'منتج تجريبي','product barcode should resolve the exact product');
 assert.equal(product.kcal,230);
 assert.equal(product.protein,null,'unknown protein must remain null');
 assert.equal(product.incomplete,true,'partial product nutrition information must be declared');
 assert(n.view().includes('بيانات ناقصة'),'incomplete data should be disclosed on selection');
 assert.equal(fetchCount,1);
 await n.searchBarcode('3017620422003');
 assert.equal(fetchCount,1,'repeated lookup should use cached product');
 barcodeResult='missing';
 const absent=await n.searchBarcode('1234567890123');
 assert.equal(absent,null,'unknown code should not produce fabricated nutrition');
 assert(n.view().includes('مش مسجّل')||n.view().includes('ملقيناش'),'unsupported product should invite manual entry');
 // On-device photo decoding never uploads the picture; only the detected code is fetched.
 let closed=false;
 ctx.createImageBitmap=async()=>({close:()=>{closed=true}});
 ctx.window.BarcodeDetector=class{
  constructor(x){assert(x.formats.includes('ean_13'))}
  async detect(){return [{rawValue:'3017620422003'}]}
 };
 const input={files:[{size:5000}],value:'photo'};
 await n.scanBarcodePhoto(input);
 assert.equal(closed,true,'temporary image bitmap should be released');
 assert.equal(input.value,'','image file picker should be cleared');
 assert.equal(fetchCount,2,'product photo should reuse existing barcode cache');
 console.log('✓ Nutrition v3: expanded foods, custom labels per serving, searching, partial data, barcode lookup and local image detection.');
})().catch(e=>{console.error(e);process.exitCode=1});
