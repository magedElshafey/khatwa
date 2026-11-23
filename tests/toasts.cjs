// Dependency-free DOM regression tests for Khatwa's global notifications.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.resolve(__dirname,'../toasts.js'),'utf8');
const timers=new Map();
let nextTimer=0;
class FakeElement{
 constructor(tag){
  this.tag=tag;this.children=[];this.parent=null;this.isConnected=false;
  this.attributes={};this.className='';this.textContent='';this.innerHTML='';this.events={};
  this.styles={};this.style={setProperty:(name,value)=>{this.styles[name]=value}};
  this.classes=new Set();
  this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),contains:x=>this.classes.has(x)};
 }
 append(...nodes){for(const node of nodes){this.children.push(node);node.parent=this;node.isConnected=true}}
 appendChild(node){this.append(node)}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;this.isConnected=false}
 setAttribute(name,value){this.attributes[name]=value}
 addEventListener(name,fn){(this.events[name]??=[]).push(fn)}
 fire(name,params={}){for(const cb of this.events[name]||[])cb(params)}
 contains(node){return this===node||this.children.some(x=>x.contains(node))}
}
const body=new FakeElement('body');body.isConnected=true;
const doc={body,createElement:tag=>new FakeElement(tag)};
const fakeTimeout=(cb,time)=>{const i=++nextTimer;timers.set(i,{cb,time});return i};
const context=vm.createContext({document:doc,window:{},Date,Object,Map,Number,String,Math,setTimeout:fakeTimeout,clearTimeout:i=>timers.delete(i),console});
vm.runInContext(src,context);
const toast=context.window.KhatwaToast;
assert.equal(typeof toast.show,'function','global toast API missing');
assert.equal(toast.show(''),null,'empty notifications should be ignored');
const successful=toast.success('اتحفظت بياناتك.');
assert(successful,'success notification did not return ID');
assert.equal(body.children.length,1,'notification host not mounted');
const host=body.children[0];
assert.equal(host.children.length,1);
const first=host.children[0];
assert.equal(first.attributes.role,'status');
assert.equal(first.children[1].children[1].textContent,'اتحفظت بياناتك.');
assert(first.className.includes('khatwa-toast--success'),'success style not applied');
assert.equal(first.children.at(-1).className,'khatwa-toast-progress','timed toast should have subtle duration indicator');
assert.equal(toast.success('اتحفظت بياناتك.'),successful,'identical duplicate should not stack');
const failed=toast.error('تعذر المزامنة');
assert.equal(host.children[1].attributes.role,'alert','errors must be announced assertively');
assert(host.children[1].className.includes('--error'));
const unsafe='<img src=x onerror=alert(1)>';
toast.warning(unsafe);
const warning=host.children[2];
assert.equal(warning.children[1].children[1].textContent,unsafe,'messages must remain plain text');
assert(!warning.innerHTML.includes(unsafe),'untrusted text must not be inserted as HTML');
assert.equal(host.children.length,3);
toast.info('معلومة إضافية');
assert.equal(host.children.length,3,'toast stack must cap visible messages at 3');
assert(!host.children.includes(first),'oldest toast must be pruned after stack cap');
const toClose=host.children[2];
const closeButton=toClose.children.find(x=>x.tag==='button');
assert.equal(closeButton.attributes['aria-label'],'إغلاق الإشعار');
closeButton.fire('click');
assert(toClose.classes.has('is-leaving'),'dismiss should play leaving animation');
toClose.fire('animationend');
assert(!host.children.includes(toClose),'close control should remove notification');
const hold=host.children[0];
const countBefore=timers.size;
hold.fire('mouseenter');
assert(hold.classes.has('is-paused'),'hover must pause its dismissal timer');
assert(timers.size<countBefore,'pause must stop the timer');
hold.fire('mouseleave');
assert(!hold.classes.has('is-paused'),'hover end must resume timer');
hold.fire('pointerdown',{pointerType:'touch',clientX:10,clientY:20});
hold.fire('pointerup',{clientX:120,clientY:25});
assert(hold.classes.has('is-leaving'),'horizontal touch swipe must dismiss');
hold.fire('animationend');
toast.dismissAll();
for(const item of host.children.slice())item.fire('animationend');
assert.equal(body.children.length,0,'empty toast host should be removed');
console.log('✓ Global toasts: accessible roles, safe text, dedupe, stack cap, close, hover and swipe.');
