/* Optional, website-only Google Analytics. Never used in the extension. */
(() => {
  "use strict";
  const id = "G-JNJBLJPDGQ";
  const key = "otlfrosta.ga4_consent";
  const origin = "https://otlfrosta.com";
  const url = new URL(window.location.href);
  function get(k) {
    try { return window.localStorage.getItem(k); } catch { return null; }
  }
  function save(value) {
    try { window.localStorage.setItem(key, value); } catch { /* Page-only choice. */ }
  }
  const testParam = url.searchParams.get("analytics_test");
  if (url.origin !== origin || testParam === "1" ||
      (testParam !== "0" && get("otlfrosta.analytics_test") === "1") ||
      navigator.globalPrivacyControl === true || navigator.webdriver === true) return;
  const panel = document.querySelector("[data-analytics-consent]");
  const settings = document.querySelector("[data-analytics-settings]");
  if (!panel || !settings) return;
  let active = false;
  let loaded = false;
  const denied = { analytics_storage: "denied", ad_storage: "denied",
    ad_user_data: "denied", ad_personalization: "denied" };
  const path = new URL(document.querySelector('link[rel="canonical"]').href).pathname;
  const pageLocation = new URL(path, origin);
  for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
    const v = url.searchParams.get(k);
    if (v && v.length <= 100 && /^[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(v)) pageLocation.searchParams.set(k,v);
  }
  function enable() {
    if (active) return;
    active = true;
    window["ga-disable-"+id] = false;
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    const gtag = function () { window.dataLayer.push(arguments); };
    window.gtag = gtag;
    gtag("consent","default",denied);
    gtag("consent","update",{...denied,analytics_storage:"granted"});
    gtag("js",new Date());
    let referrer="";
    try { referrer=document.referrer ? new URL(document.referrer).origin+"/" : ""; } catch {}
    gtag("config",id,{allow_google_signals:false,allow_ad_personalization_signals:false,
      send_page_view:false,page_location:pageLocation.href,page_referrer:referrer});
    gtag("event","page_view",{send_to:id});
    const script=document.createElement("script");
    script.async=true;
    script.src="https://www.googletagmanager.com/gtag/js?id="+id;
    script.referrerPolicy="strict-origin";
    document.head.append(script);
  }
  function disable() {
    window["ga-disable-"+id]=true;
    active=false;
    for (const cookie of document.cookie.split(";")) {
      const name=cookie.split("=")[0].trim();
      if (name!=="_ga" && !/^_ga_[A-Za-z0-9_]+$/.test(name)) continue;
      document.cookie=name+"=; Max-Age=0; Path=/; Secure; SameSite=Lax";
      document.cookie=name+"=; Max-Age=0; Domain=otlfrosta.com; Path=/; Secure; SameSite=Lax";
    }
    // Do not reload if the choice could not be persisted.
    if (get(key)==="denied") window.location.reload();
  }
  function select(choice) {
    save(choice);
    panel.hidden=true;
    if(choice==="granted") enable();
    else if(active) disable();
  }
  panel.querySelector("[data-analytics-accept]").addEventListener("click",()=>select("granted"));
  panel.querySelector("[data-analytics-reject]").addEventListener("click",()=>select("denied"));
  settings.hidden=false;
  settings.addEventListener("click",()=>{panel.hidden=!panel.hidden;});
  window.addEventListener("storage",event=>{
    if(event.key===key && event.newValue!=="granted" && active) disable();
    if(event.key==="otlfrosta.analytics_test" && event.newValue==="1" && active) {
      window["ga-disable-"+id]=true;
      active=false;
      window.location.reload();
    }
  });
  // Outbound store clicks are not actual installs.
  document.addEventListener("click",event=>{
    if(!active || !event.isTrusted) return;
    const anchor=event.target.closest?.("a[href]");
    if(!anchor) return;
    const target=new URL(anchor.href);
    if(target.origin==="https://chromewebstore.google.com" &&
       target.pathname==="/detail/ldpbiafkgjlaooeplkiooljccpalpkgf")
      window.gtag("event","store_click",{send_to:id,page_path:path});
  });
  // A stronger engagement signal, once per page, after explicit consent.
  let visibleMs=0, interacted=false, reported=false;
  for(const type of ["pointerdown","keydown","wheel","touchstart"]) {
    document.addEventListener(type,event=>{if(active && event.isTrusted) interacted=true;},{passive:true});
  }
  window.setInterval(()=>{
    if(!active || reported || document.visibilityState!=="visible") return;
    visibleMs+=1000;
    if(interacted && visibleMs>=10000) {
      reported=true;
      window.gtag("event","engaged_visit",{send_to:id,page_path:path});
    }
  },1000);
  const choice=get(key);
  if(choice==="granted") enable();
  else if(choice!=="denied") panel.hidden=false;
})();
