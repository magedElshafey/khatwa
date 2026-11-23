// Quitting companion: real-time clock, personal reasons, craving support and logged restart.
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const script=fs.readFileSync(path.resolve(__dirname,'../quit-support.js'),'utf8');
const start=new Date(Date.now()-3*24*3600000);
const local=v=>{const p=n=>String(n).padStart(2,'0');return v.getFullYear()+'-'+p(v.getMonth()+1)+'-'+p(v.getDate())+'T'+p(v.getHours())+':'+p(v.getMinutes())};
const settings={smoking:{avg:20,packSize:20,packPrice:100,start:local(start).slice(0,10),quitAt:local(start)},quitReasons:[]};
const state={settings,rows:[]},written=[],changed=[],messages=[],timers=[];
let renders=0;
const fields={};
const fakeForm={dataset:{form:'quit-reasons'},data:{reasons:''}};
const fakeElements={days:{textContent:''},hours:{textContent:''},minutes:{textContent:''}};
const container={
 getAttribute:()=>state.settings.smoking.quitAt,
 querySelector:selector=>fakeElements[selector.split('data-quit-clock-')[1]?.replace(']','')]||null
};
const document={
 hidden:false,activeElement:{isConnected:false},
 querySelectorAll:()=>[container],
 querySelector:()=>null,
 addEventListener:()=>{}
};
const window={
 addEventListener:()=>{},
 KhatwaToast:{success:text=>messages.push(['success',text]),info:text=>messages.push(['info',text])}
};
const sandbox={
 window,document,state,Date,Math,Number,Set,Array,Object,String,Map,console,
 setInterval:(fn,ms)=>{timers.push({fn,ms});return 1;},
 setTimeout:fn=>{fn();return 1;},
 FormData:class{constructor(form){this.fields=form.data}get(name){return this.fields[name]??null}},
 save:async(collection,date,data)=>{
  const item={id:'relapse-'+(written.length+1),collection,date,data};
  state.rows.push(item);written.push(item);
 },
 saveSettings:async value=>{state.settings=value;changed.push(value)},
 group:collection=>state.rows.filter(r=>r.collection===collection),
 render:()=>{renders++}
};
vm.runInNewContext(script,sandbox);
const quit=window.KhatwaQuit;
(async()=>{
 const base='2026-11-20T07:40',t0=new Date(base).getTime();
 const elapsed=quit.elapsed(base,t0+(3*86400+7*3600+25*60)*1000);
 assert.deepEqual([elapsed.days,elapsed.hours,elapsed.minutes],[3,7,25],'elapsed calculation must have whole days, hours and minutes');
 assert.equal(quit.elapsed(base,t0-10000).future,true,'future timestamp must not make negative counts');
 assert.equal(quit.elapsed('invalid',Date.now()).valid,false,'invalid timestamp must not create a false streak');
 assert(quit.clock(base).includes('data-quit-clock-days'),'clock must expose live update targets');
 quit.start();
 assert.equal(timers.length,1,'the clock must install one shared interval');
 assert.equal(timers[0].ms,10000,'timer should refresh when minutes roll over');
 quit.start();
 assert.equal(timers.length,1,'clock interval must not be installed twice');
 quit.refresh();
 assert(fakeElements.days.textContent.length>0&&fakeElements.hours.textContent.length>0&&fakeElements.minutes.textContent.length>0,'clock DOM fields are not refreshed');
 assert(quit.reasonsCard().includes('ضيف أسبابك'),'empty reasons must be explicitly editable');
 const reasonText='صحتي\nنفسي أتنفس براحة\n'+ '<img src=x>';
 fakeForm.data={reasons:reasonText};
 assert.equal(await quit.submit(fakeForm),true);
 assert.deepEqual([...state.settings.quitReasons],['صحتي','نفسي أتنفس براحة','<img src=x>']);
 assert(quit.reasonsCard().includes('&lt;img src=x&gt;'),'reasons must be escaped to avoid HTML injection');
 assert(!quit.reasonsCard().includes('<img src=x>'),'unsafe raw tags should never be rendered');
 assert(quit.reasonsCard().includes('صحتي'),'reasons must remain visible on page');

 assert(quit.reasonsCard().includes('quit-reasons-featured'),'primary motivation must be prominent');
 assert(quit.reasonsCard().includes('quit-reasons-grid'),'additional motivations must have dedicated readable cards');
 assert(quit.reasonsCard().includes('quit-reason-tile is-primary'),'featured reason must also be shown in full in the card list');
 assert(quit.reasonsCard().includes('data-form="quit-reason-add"'),'adding motivations should be a one-reason form, not a bulk textarea');
 const newReason={dataset:{form:'quit-reason-add'},data:{reason:'عائلتي'}};
 assert.equal(await quit.submit(newReason),true,'new reason should be saved immediately');
 assert.equal(quit.getReasons().length,4);
 await assert.rejects(quit.submit(newReason),/موجود بالفعل/,'duplicate reasons should not be added twice');
 assert(quit.reasonsCard().includes('عائلتي'),'new reason must appear in cards');
 await quit.action('quit-edit-reasons');
 assert(quit.reasonsCard().includes('رتّب وعدّل أسبابك'),'reason manager must be clear');
 await quit.action('quit-reason-open-edit',{dataset:{index:'1'}});
 assert(quit.reasonsCard().includes('data-form="quit-reason-edit"'),'reason edit must be inline');
 const editForm={dataset:{form:'quit-reason-edit',index:'1'},data:{reason:'نفسي أعيش بصحة'}};
 assert.equal(await quit.submit(editForm),true,'editing one reason should persist');
 assert.equal(quit.getReasons()[1],'نفسي أعيش بصحة');
 await quit.action('quit-reason-up',{dataset:{index:'1'}});
 assert.equal(quit.getReasons()[0],'نفسي أعيش بصحة','reordering must update the featured reason');
 assert(quit.reasonsCard().includes('نفسي أعيش بصحة'),'reordered featured reason must appear');
 await quit.action('quit-reason-down',{dataset:{index:'0'}});
 assert.equal(quit.getReasons()[0],'صحتي','down should restore previous order');
 await quit.action('quit-reason-delete',{dataset:{index:'3'}});
 assert(quit.reasonsCard().includes('تأكيد الحذف'),'deletion requires visible confirmation');
 assert.equal(quit.getReasons().length,4,'opening delete confirmation cannot delete data');
 await quit.action('quit-reason-cancel-delete');
 assert.equal(quit.getReasons().length,4,'cancelling delete must preserve data');
 await quit.action('quit-reason-delete',{dataset:{index:'3'}});
 await quit.action('quit-reason-delete-confirm',{dataset:{index:'3'}});
 assert.equal(quit.getReasons().length,3,'confirmed delete should remove exactly one reason');
 assert(!quit.reasonsCard().includes('عائلتي'),'deleted reason must disappear from UI');

 assert(quit.action('quit-urge'),true);
 assert(quit.modal().includes('صحتي')&&quit.modal().includes('أجّل قرار التدخين'),'craving modal must remind user of motivations and coping strategies');
 assert.equal(written.length,0,'an urge must never be logged as relapse');
 quit.action('quit-urge-passed');
 assert.equal(written.length,0,'resisting the urge must not create a relapse record');
 quit.action('quit-record-open');
 assert(quit.modal().includes('أنا دخّنت بالفعل'),'logging requires first compassionate reminder');
 quit.action('quit-actually-smoked');
 assert(quit.modal().includes('name="confirmed"'),'actual smoking record must need explicit confirmation');
 const smokedAt=local(new Date(Date.now()-5*60000)),newStart=local(new Date(Date.now()-2*60000));
 const invalid={dataset:{form:'quit-relapse'},data:{count:'1',smokedAt,newStart,note:'ضغط',confirmed:''}};
 await assert.rejects(quit.submit(invalid),/أكد/,'submission needs explicit confirmation');
 assert.equal(written.length,0);
 const form={dataset:{form:'quit-relapse'},data:{count:'2',smokedAt,newStart,note:'ضغط',confirmed:'yes'}};
 assert.equal(await quit.submit(form),true);
 assert.equal(written.length,1,'relapse must be stored as actual event');
 assert.equal(written[0].collection,'smoking-relapse');
 assert.equal(written[0].data.count,2);
 assert.equal(written[0].data.previousQuitAt,local(start),'previous quit start must remain in history');
 assert.equal(state.settings.smoking.quitAt,newStart,'a confirmed relapse starts a fresh clock');
 assert.equal(state.settings.smoking.start,newStart.slice(0,10),'legacy start date should stay compatible');
 assert.equal(quit.getReasons().length,3,'new quit attempt must preserve reasons');
 assert(quit.slipHistory().includes('2 سيجارة مسجلة'),'relapse history should be visible');
 assert(messages.some(x=>x[0]==='info'),'restarting should be encouraging rather than blaming');
 const oldStart=new Date('2020-01-01T10:00').getTime();
 assert(quit.elapsed(local(start),oldStart).future,'old attempted times must not generate negative durations');
 console.log('✓ Quitting companion: elapsed timer, periodic refresh, reasons, encouragement, confirmed relapse reset & history.');
})().catch(error=>{console.error(error);process.exitCode=1});
