// End-to-end behavior contract for auth-first Khatwa, with mocked Supabase network.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../cloud-sync.js'),'utf8');
const cloudEvents=[];
let sequence=0;
const USER_ID='00000000-0000-4000-8000-000000000001';
const token='test-access-token';
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value,text:async()=>JSON.stringify(value)});
const fakeFetch=async(url,opts={})=>{
 if(url.includes('/auth/v1/token?grant_type=password'))return response({access_token:token,refresh_token:'r-token',expires_in:3600,user:{id:USER_ID,email:'test@example.com'}});
 if(url.includes('/auth/v1/user'))return response({id:USER_ID,email:'test@example.com'});
 if(url.includes('/auth/v1/token?grant_type=refresh_token'))return response({access_token:token,refresh_token:'r-token',expires_in:3600,user:{id:USER_ID,email:'test@example.com'}});
 if(url.includes('/auth/v1/signup'))return response({user:{id:USER_ID,email:'test@example.com'}});
 if(url.includes('/rest/v1/khatwa_events?')){
  if(opts.method==='POST'){
   const entries=JSON.parse(opts.body);
   entries.forEach(e=>{if(!cloudEvents.some(x=>x.id===e.id))cloudEvents.push({...e,created_at:new Date(Date.now()+(++sequence)).toISOString()})});
   return {ok:true,status:201,text:async()=>'',json:async()=>({})};
  }
  const q=new URL(url).searchParams;
  let entries=cloudEvents.slice().sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
  const since=q.get('created_at');
  if(since?.startsWith('gte.'))entries=entries.filter(e=>e.created_at>=since.slice(4));
  return response(entries.slice(Number(q.get('offset')||0),Number(q.get('offset')||0)+Number(q.get('limit')||500)).map(e=>({...e})));
 }
 throw Error('Unexpected request: '+url);
};
const clone=x=>JSON.parse(JSON.stringify(x));
const nextId=()=>String(++sequence).padStart(8,'0')+'-1111-4111-8111-111111111111';
function createClient({storage=new Map(),databases=new Map(),originalRecords=[]}={}){
 let db=databases.get('legacy');
 if(!db){db={records:new Map(),meta:new Map()};originalRecords.forEach(r=>db.records.set(r.id,clone(r)));databases.set('legacy',db)}
 const state={rows:[...db.records.values()],settings:{displayName:'',goals:[]},db:true};
 let online=true,renderCount=0,backups=0;
 const store={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const context=vm.createContext({
  window:{addEventListener:()=>{}},document:{addEventListener:()=>{},hidden:false},
  localStorage:store,navigator:{get onLine(){return online}},location:{origin:'https://khatwa-ruby.vercel.app'},
  crypto:{randomUUID:nextId},URL,URLSearchParams,fetch:fakeFetch,Date,JSON,Math,Number,String,Array,Object,Set,Map,
  FormData:class{constructor(form){this.values=form.values}get(k){return this.values[k]||''}},
  confirm:()=>true,setInterval:()=>0,clearInterval:()=>{},console
 });
 vm.runInContext(source,context);
 const cloud=context.window.KhotwaCloud;
 const hooks={
  state,defaults:{displayName:'',goals:[]},
  dbGetAll:async name=>[...db[name].values()].map(clone),
  dbPut:async(name,obj)=>{db[name].set(obj.id,clone(obj))},
  dbDelete:async(name,id)=>{db[name].delete(id)},
  switchAccountDatabase:async userId=>{
   const name='account-'+userId;
   db=databases.get(name);
   if(!db){db={records:new Map(),meta:new Map()};databases.set(name,db)}
   state.rows=[...db.records.values()].map(clone);
   const settings=db.meta.get('settings')?.data;
   state.settings=settings?clone(settings):{displayName:'',goals:[]};
  },
  exportLegacy:async records=>{backups++;assert(records.length>0)},
  render:()=>{renderCount++},notice:()=>{}
 };
 return {cloud,hooks,state,storage,databases,setOnline:v=>{online=v},getBackups:()=>backups,getRenders:()=>renderCount};
}
const form=()=>({dataset:{form:'cloud-login'},values:{email:'test@example.com',password:'safe-passphrase'},querySelector:()=>({disabled:false})});
const legacyRow={id:'workout-old-1',collection:'workout',date:'2026-11-22',data:{exercise:'Bench Press',set:1,reps:8,weight:30},updatedAt:'2026-11-22T08:00:00.000Z'};
(async()=>{
 const deviceA=createClient({originalRecords:[legacyRow]});
 await deviceA.cloud.init(deviceA.hooks);
 assert.equal(deviceA.cloud.isAuthenticated(),false,'logged-out app should not show private modules');
 assert.equal(deviceA.cloud.isReady(),true);
 await deviceA.cloud.submit(form());
 assert.equal(deviceA.cloud.isAuthenticated(),true);
 assert.equal(deviceA.cloud.isPrepared(),false,'legacy data requires explicit migration consent');
 assert(deviceA.cloud.migrationView().includes('استيراد 1 سجل'),'migration prompt not shown');
 assert.equal(cloudEvents.length,0,'must not upload old local records automatically');
 await deviceA.cloud.action('cloud-export-legacy');
 assert.equal(deviceA.getBackups(),1,'must offer a usable legacy backup');
 await deviceA.cloud.action('cloud-import-legacy');
 assert.equal(deviceA.cloud.isPrepared(),true);
 assert.equal(deviceA.state.rows.length,1);
 assert(cloudEvents.some(e=>e.entity_id===legacyRow.id),'migration must upload approved legacy record');
 assert.equal(deviceA.databases.get('legacy').records.size,1,'legacy IndexedDB must stay intact');
 // A fresh second device signs in and gets all records without manual sync activation.
 const deviceB=createClient();
 await deviceB.cloud.init(deviceB.hooks);
 await deviceB.cloud.submit(form());
 assert.equal(deviceB.cloud.isPrepared(),true,'new devices must be ready automatically');
 assert(deviceB.state.rows.some(r=>r.id===legacyRow.id),'cloud data must download on login');
 // Durable token enables subsequent browser opens without asking for password.
 const reopened=createClient({storage:deviceA.storage,databases:deviceA.databases});
 await reopened.cloud.init(reopened.hooks);
 assert.equal(reopened.cloud.isAuthenticated(),true,'saved login session lost after reopen');
 assert.equal(reopened.cloud.isPrepared(),true,'account storage should persist after reload');
 assert(reopened.state.rows.some(r=>r.id===legacyRow.id),'cached account data disappeared');
 // A new steps record saved offline must not upload until reconnected.
 const steps={id:'steps-2026-11-23',collection:'steps',date:'2026-11-23',data:{count:8200},updatedAt:'2026-11-23T09:00:00.000Z'};
 reopened.setOnline(false);
 await reopened.hooks.dbPut('records',steps);
 reopened.state.rows.push(steps);
 await reopened.cloud.enqueue('record','upsert',steps.id,steps);
 assert.equal(reopened.cloud.getStatus().pending>0,true,'offline mutation must be stored');
 assert.equal(cloudEvents.some(e=>e.entity_id===steps.id),false,'offline entry was uploaded unexpectedly');
 reopened.setOnline(true);
 await reopened.cloud.sync();
 await deviceB.cloud.sync();
 assert(deviceB.state.rows.some(r=>r.id===steps.id&&r.data.count===8200),'step update must sync across devices');
 // Signout locks the client; the server and account IndexedDB records remain intact.
 await deviceB.cloud.action('cloud-signout');
 assert.equal(deviceB.cloud.isAuthenticated(),false);
 assert.equal(deviceB.state.rows.length,0,'signed-out in-memory data must be hidden');
 assert.equal(deviceB.databases.get('account-'+USER_ID).records.has(legacyRow.id),true,'logout must not delete account data');
 console.log('✓ Cloud integration: login gate, legacy migration, fresh device restore, remembered login, offline steps, logout.');
})().catch(e=>{console.error(e);process.exitCode=1});
