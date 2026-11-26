import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const source=readFileSync(new URL("../public/analytics.js",import.meta.url),"utf8");
function boot({url="https://otlfrosta.com/",consent=null,internal=false,gpc=false,webdriver=false}={}) {
  const storage=new Map();
  if(consent) storage.set("otlfrosta.ga4_consent",consent);
  if(internal) storage.set("otlfrosta.analytics_test","1");
  const handlers=new Map(),appended=[],timers=[];
  const control=name=>({hidden:true,addEventListener(type,cb){handlers.set(name+":"+type,cb);}});
  const accept=control("accept"),reject=control("reject"),settings=control("settings");
  const panel={hidden:true,querySelector(sel){return sel.includes("accept")?accept:reject;}};
  const location=new URL(url);
  const window={location,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},
    addEventListener:(type,cb)=>handlers.set("window:"+type,cb),setInterval:cb=>timers.push(cb)};
  location.reload=()=>{window.reloaded=true;};
  const document={referrer:"https://www.google.com/search?q=private",cookie:"",visibilityState:"visible",
    querySelector(sel){return sel.includes("canonical")?{href:"https://otlfrosta.com/"}:sel.includes("consent")?panel:settings;},
    createElement:()=>({}),head:{append:tag=>appended.push(tag)},addEventListener:(type,cb)=>handlers.set("document:"+type,cb)};
  runInNewContext(source,{window,document,navigator:{globalPrivacyControl:gpc,webdriver},URL,Date});
  return {window,document,storage,handlers,appended,timers,panel,settings,events:()=>Array.from(window.dataLayer??[],x=>Array.from(x))};
}
test("no tag before opt-in or after denial",()=>{
  const a=boot();assert.equal(a.appended.length,0);assert.equal(a.panel.hidden,false);
  a.handlers.get("reject:click")();assert.equal(a.appended.length,0);
  assert.equal(a.storage.get("otlfrosta.ga4_consent"),"denied");
  assert.equal(boot({consent:"denied"}).panel.hidden,true);
});
test("only website property, sanitized explicit location, advertising disabled, revoke",()=>{
  const a=boot({url:"https://otlfrosta.com/?utm_source=reddit&secret=private"});
  a.handlers.get("accept:click")();
  assert.equal(a.appended[0].src,"https://www.googletagmanager.com/gtag/js?id=G-JNJBLJPDGQ");
  const config=a.events().find(x=>x[0]==="config");
  assert.equal(config[2].page_location,"https://otlfrosta.com/?utm_source=reddit");
  assert.equal(config[2].page_referrer,"https://www.google.com/");
  assert.equal(config[2].allow_google_signals,false);assert.equal(config[2].allow_ad_personalization_signals,false);
  assert.equal(a.events().filter(x=>x[1]==="page_view").length,1);
  a.handlers.get("accept:click")();assert.equal(a.appended.length,1);
  a.handlers.get("reject:click")();assert.equal(a.window["ga-disable-G-JNJBLJPDGQ"],true);assert.equal(a.window.reloaded,true);
});
test("unpersisted revocation does not load a duplicate tag on re-enable",()=>{
  const a=boot({consent:"granted"});
  a.window.localStorage.setItem=()=>{throw Error("blocked");};
  a.handlers.get("reject:click")();
  assert.equal(a.window["ga-disable-G-JNJBLJPDGQ"],true);
  assert.equal(a.window.reloaded,undefined);
  a.handlers.get("accept:click")();
  assert.equal(a.window["ga-disable-G-JNJBLJPDGQ"],false);
  assert.equal(a.appended.length,1);
});
test("test and privacy signals override saved opt-in",()=>{
  for(const opt of [{internal:true},{url:"https://otlfrosta.com/?analytics_test=1"},{url:"https://preview.otlfrosta-web.pages.dev/"},{gpc:true},{webdriver:true}]) {
    const a=boot({consent:"granted",...opt});assert.equal(a.appended.length,0);assert.equal(a.settings.hidden,true);
  }
  assert.equal(boot({consent:"granted",internal:true,url:"https://otlfrosta.com/?analytics_test=0"}).appended.length,1);
});
test("trusted store click is not install; foreground engagement requires interaction",()=>{
  const a=boot({consent:"granted"}),click=a.handlers.get("document:click");
  const target={closest:()=>({href:"https://chromewebstore.google.com/detail/ldpbiafkgjlaooeplkiooljccpalpkgf"})};
  click({target,isTrusted:false});click({target,isTrusted:true});
  assert.equal(a.events().filter(x=>x[1]==="store_click").length,1);
  assert.equal(a.events().filter(x=>x[1]==="install").length,0);
  for(let i=0;i<10;i++)a.timers[0]();
  assert.equal(a.events().filter(x=>x[1]==="engaged_visit").length,0);
  a.handlers.get("document:keydown")({isTrusted:true});a.timers[0]();a.timers[0]();
  assert.equal(a.events().filter(x=>x[1]==="engaged_visit").length,1);
});
