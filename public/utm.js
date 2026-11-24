/* First-party campaign pass-through. Explicit developer test mode is stored as a boolean, never a visitor ID. No network calls. */
(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const storageKey = "otlfrosta.analytics_test";
  const production = window.location.origin === "https://otlfrosta.com";
  const testParam = params.get("analytics_test");
  let internalTest = !production || testParam === "1";
  if (production) {
    try {
      if (testParam === "1") window.localStorage.setItem(storageKey, "1");
      else if (testParam === "0") window.localStorage.removeItem(storageKey);
      if (testParam !== "0") internalTest ||= window.localStorage.getItem(storageKey) === "1";
    } catch {
      // The current URL still controls test mode if storage is unavailable.
    }
  }

  const incoming = new Map();
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = params.get(key);
    // Restrict to short campaign labels so arbitrary URL inputs are not forwarded.
    if (value && value.length <= 100 && /^[A-Za-z0-9][A-Za-z0-9._~-]*$/.test(value)) {
      incoming.set(key, value);
    }
  }

  if (!internalTest && incoming.size === 0) return;
  const storeHost = "chromewebstore.google.com";
  const storePath = "/detail/ldpbiafkgjlaooeplkiooljccpalpkgf";

  for (const anchor of document.querySelectorAll(internalTest ? "a[href]" : "a[data-store-cta]")) {
    const target = new URL(anchor.href);
    if (target.protocol !== "https:" || target.hostname !== storeHost || target.pathname !== storePath) continue;

    if (internalTest) {
      target.searchParams.set("utm_source", "internal_test");
      target.searchParams.set("utm_medium", "test");
      target.searchParams.set("utm_campaign", "website_test");
    } else {
      for (const [key, value] of incoming) target.searchParams.set(key, value);
    }
    anchor.href = target.toString();
  }
})();
