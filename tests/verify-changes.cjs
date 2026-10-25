const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
function harness(initial = {}, failValue) {
 const store = new Map(Object.entries(initial));
 const controls = new Map(); let reloaded = false;
 const document = { getElementById(id) { if (!controls.has(id)) controls.set(id, { textContent: '', addEventListener(type, fn) {this[type] = fn;} }); return controls.get(id); } };
 const localStorage = { getItem:k=>store.get(k)??null, setItem(k,v){if(v===failValue)throw Error('full');store.set(k,v);}, removeItem:k=>store.delete(k) };
 const context = {document, localStorage, siteStorage:{...localStorage, removeItem(k){store.delete(k);return true;}}, siteHttpUrl:s=>/^https?:\/\//.test(s)?s:null, location:{reload(){reloaded=true;}}, confirm:()=>true};
 vm.runInNewContext(fs.readFileSync('site-data.js','utf8'),context);
 return {store,controls,reloaded:()=>reloaded,async load(data){const input={files:[{size:100,text:async()=>JSON.stringify(data)}],value:'file'};await controls.get('importDataFile').change({target:input});}};
}
(async()=>{
 let h=harness({theme:'light',localProfile:'keep'});
 await h.load({format:'susysam-backup',version:1,data:{theme:'dark'}});
 assert.equal(h.store.get('theme'),'dark');assert.equal(h.store.get('localProfile'),'keep');assert(h.reloaded());
 h=harness({theme:'light'});await h.load({format:'susysam-backup',version:1,data:{localProfile:'overwrite'}});assert.equal(h.store.get('localProfile'),undefined);assert(!h.reloaded());
 h=harness({theme:'light',backgroundUrl:'https://old.test'},'https://fail.test');await h.load({format:'susysam-backup',version:1,data:{theme:'dark',backgroundUrl:'https://fail.test'}});assert.equal(h.store.get('theme'),'light');assert.equal(h.store.get('backgroundUrl'),'https://old.test');assert(!h.reloaded());
 h=harness({theme:'light',lastWatched:'{}',recentImdbMedia:'[]'});h.controls.get('deleteHistoryBtn').click();assert.equal(h.store.get('lastWatched'),undefined);assert.equal(h.store.get('theme'),'light');
 h=harness({theme:'dark'});await h.load({format:'susysam-backup',version:1,data:{timeZone:'UTC'}});assert.equal(h.store.get('timeZone'),'UTC');assert.equal(h.store.get('theme'),'dark');assert(h.reloaded());
 h=harness({timeZone:'UTC'});await h.load({format:'susysam-backup',version:1,data:{timeZone:'Invented/Zone'}});assert.equal(h.store.get('timeZone'),'UTC');assert(!h.reloaded());
 const crypto=require('crypto').webcrypto; const data=new Map();
 const ctx={crypto,TextEncoder,Uint8Array,window:{},siteStorage:{getItem:k=>data.get(k)??null,setItem:()=>false,removeItem:()=>true}};
 vm.runInNewContext(fs.readFileSync('local-profile.js','utf8'),ctx);await ctx.window.localProfile.ready;
 await assert.rejects(ctx.window.localProfile.create('test','test-pass'));
 console.log('PASS: import round trip, credential rejection, failed-import rollback, history-only deletion, timezone import, invalid timezone rejection, failed profile persistence.');
})().catch(e=>{console.error(e);process.exitCode=1});
