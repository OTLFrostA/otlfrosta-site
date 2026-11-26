#!/usr/bin/env node
// Validate the deployable Cloudflare Pages directory without dependencies or network access.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../public");
const origin = "https://otlfrosta.com";
const errors = [];
let checkedLinks = 0;

function check(condition, message) {
  if (!condition) errors.push(message);
}

function read(relativePath) {
  const location = join(siteRoot, relativePath);
  check(existsSync(location), "Missing required file: " + relativePath);
  return existsSync(location) ? readFileSync(location, "utf8") : "";
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const pathname = join(directory, entry.name);
    return entry.isDirectory() ? walk(pathname) : [pathname];
  });
}

function attribute(tag, name) {
  const match = tag.match(new RegExp("\\b" + name + "\\s*=\\s*([\"'])(.*?)\\1", "i"));
  return match ? match[2] : null;
}

function servedFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.split("/").includes("..")) return null;
  const clean = decoded.replace(/^\/+/, "");
  const candidates = clean === "" || clean.endsWith("/")
    ? [join(clean, "index.html")]
    : [clean, clean + ".html", join(clean, "index.html")];

  for (const candidate of candidates) {
    const absolute = resolve(siteRoot, candidate);
    if (absolute !== siteRoot && !absolute.startsWith(siteRoot + sep)) continue;
    if (existsSync(absolute) && statSync(absolute).isFile()) return absolute;
  }
  return null;
}

function inspectLink(source, raw, baseURL, idsByFile) {
  if (!raw || raw.startsWith("data:")) return;
  const unescaped = raw.replaceAll("&amp;", "&");
  let url;
  try {
    url = new URL(unescaped, baseURL);
  } catch {
    errors.push(source + ": malformed URL " + raw);
    return;
  }
  if (url.origin !== origin && url.origin !== "https://www.otlfrosta.com") return;
  checkedLinks++;
  const destination = servedFile(url.pathname);
  if (!destination) {
    errors.push(source + ": missing local URL " + raw);
    return;
  }
  if (url.hash && destination.endsWith(".html")) {
    let fragment;
    try {
      fragment = decodeURIComponent(url.hash.slice(1));
    } catch {
      errors.push(source + ": malformed fragment " + raw);
      return;
    }
    const ids = idsByFile.get(destination);
    if (ids && fragment && !ids.has(fragment)) {
      errors.push(source + ": missing fragment #" + fragment + " in " + relative(siteRoot, destination));
    }
  }
}

const required = [
  "index.html", "features.html", "examples.html", "guides.html", "changelog.html", "privacy.html", "website-privacy.html",
  "styles.css", "product.css", "privacy.css", "utm.js", "analytics.js", "analytics.css",
  "_headers", "_redirects", "robots.txt", "sitemap.xml",
];
for (const file of required) check(existsSync(join(siteRoot, file)), "Missing required file: " + file);

const files = walk(siteRoot);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const idsByFile = new Map();
for (const file of htmlFiles) {
  const body = readFileSync(file, "utf8");
  const ids = [...body.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  check(ids.length === new Set(ids).size,
    relative(siteRoot, file) + ": duplicate HTML id attributes");
  idsByFile.set(file, new Set(ids));
}

for (const file of htmlFiles) {
  const name = relative(siteRoot, file).replaceAll(sep, "/");
  const body = readFileSync(file, "utf8");
  const route = name === "index.html" ? "/" : "/" + name.replace(/\.html$/, "");
  const baseURL = origin + route;
  check(body.includes("/analytics.js?v=1") && body.includes("data-analytics-consent hidden"), name + ": optional analytics controls missing");
  check(body.includes('name="color-scheme" content="light"'), name + ": expected shared light theme");
  check(body.includes('name="theme-color" content="#ffffff"'), name + ": expected light browser chrome");
  check(!body.includes("googletagmanager.com/gtag/js"), name + ": Google tag must not load directly");
  const tags = body.match(/<(?:a|link|img|script|source|video|audio)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    for (const key of ["href", "src"]) {
      const value = attribute(tag, key);
      if (value) inspectLink(name, value, baseURL, idsByFile);
    }
    const srcset = attribute(tag, "srcset");
    if (srcset) {
      for (const item of srcset.split(",")) inspectLink(name, item.trim().split(/\s+/)[0], baseURL, idsByFile);
    }
    if (attribute(tag, "target") === "_blank") {
      const rel = (attribute(tag, "rel") || "").split(/\s+/);
      check(rel.includes("noopener") && rel.includes("noreferrer"),
        name + ": external-tab link needs rel=\"noopener noreferrer\"");
    }
  }
}

for (const file of files.filter((file) => file.endsWith(".css"))) {
  const name = relative(siteRoot, file).replaceAll(sep, "/");
  const body = readFileSync(file, "utf8");
  for (const match of body.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    inspectLink(name, match[1], origin + "/" + name, idsByFile);
  }
}

const sitemap = read("sitemap.xml");
const locs = [...sitemap.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => match[1]);
check(locs.length === new Set(locs).size, "Duplicate sitemap URLs");
for (const [file, route] of [
  ["index.html", "/"],
  ["features.html", "/features"],
  ["examples.html", "/examples"],
  ["guides.html", "/guides"],
  ["changelog.html", "/changelog"],
  ["privacy.html", "/privacy"],
  ["website-privacy.html", "/website-privacy"],
]) {
  const expected = origin + route;
  check(locs.includes(expected), "Missing sitemap URL: " + expected);
  const body = read(file);
  const canonical = body.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  check(canonical?.[1] === expected, file + ": canonical must be " + expected);
  check(body.includes('id="main"'), file + ": missing main landmark");
  check(body.includes("<title>"), file + ": missing title");
}
for (const loc of locs) inspectLink("sitemap.xml", loc, origin + "/", idsByFile);

for (const policy of ["privacy.html", "website-privacy.html"]) {
  const content = read(policy);
  check(content.includes('id="english"') && content.includes('id="chinese"'),
    policy + ": both policy languages must be present");
}

const redirects = read("_redirects").split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith("#"));
const rules = redirects.map((line) => line.trim().split(/\s+/));
check(rules.every((tokens) => tokens.length === 3 && tokens[0].startsWith("/") && /^\d{3}$/.test(tokens[2])),
  "_redirects has an invalid rule");
check(rules.some((rule) => rule[0] === "/x" && rule[2] === "302" && rule[1].includes("utm_source=twitter")),
  "Missing X bio 302 UTM redirect");
for (const rule of rules) {
  if (rule.length === 3) inspectLink("_redirects", rule[1], origin + "/", idsByFile);
}

const robots = read("robots.txt");
check(robots.includes("Sitemap: " + origin + "/sitemap.xml"), "robots.txt sitemap URL is missing");
const headers = read("_headers");
for (const header of ["Content-Security-Policy:", "X-Content-Type-Options: nosniff", "X-Frame-Options: DENY"]) {
  check(headers.includes(header), "_headers missing " + header);
}

check(read("index.html").match(/data-store-cta/g)?.length >= 3, "Expected navigation, hero, and closing store CTAs");
const homepage = read("index.html");
check(homepage.includes("/demo/workbench.png") && homepage.includes("/demo/popup.png"), "Homepage requires real fixture screenshots");
check(homepage.includes("/demo/pdf-preview.png"), "Homepage requires an actual rendered PDF preview");
check(read("styles.css").includes("color-scheme:light"), "Shared CSS must use a light color scheme");
for (const id of ["tour-quick","tour-bulk","tour-live","use-cases","features","live-save","how-it-works","faq"]) check(homepage.includes('id="' + id + '"'), "Missing product workflow: " + id);
for (const file of ["solar-energy.pdf","solar-energy.md","solar-energy-html.zip","solar-energy.json","solar-energy.zip"]) check(read("examples.html").includes("/demo/"+file), "Missing example download: "+file);

// Cloudflare auto-injection uses both the plain and versioned beacon URLs.
const scriptSrc = headers.match(/script-src ([^;]+)/)?.[1].split(/\s+/) ?? [];
check(scriptSrc.includes("https://static.cloudflareinsights.com/beacon.min.js"),
  "CSP must permit Cloudflare's unversioned beacon");
check(scriptSrc.includes("https://static.cloudflareinsights.com/beacon.min.js/"),
  "CSP must permit Cloudflare's versioned beacon path");
check(!scriptSrc.includes("https://static.cloudflareinsights.com"),
  "Keep the beacon CSP allowlist path-specific");
check(headers.includes("connect-src 'self' "), "Automatic RUM submits to same-origin /cdn-cgi/rum");

const utmSource = read("utm.js");
const storeUrl = "https://chromewebstore.google.com/detail/ldpbiafkgjlaooeplkiooljccpalpkgf?utm_source=otlfrosta.com&utm_medium=website&utm_campaign=hero";
const storage = new Map();
function runCampaign(url, blocked = false) {
  const cta = { href: storeUrl };
  const faq = { href: storeUrl.split("?")[0] };
  const external = { href: "https://example.org/" };
  const localStorage = {
    getItem(key) { if (blocked) throw Error("storage denied"); return storage.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw Error("storage denied"); storage.set(key, value); },
    removeItem(key) { if (blocked) throw Error("storage denied"); storage.delete(key); },
  };
  runInNewContext(utmSource, {
    URL, URLSearchParams,
    window: { location: new URL(url), localStorage },
    document: { querySelectorAll(selector) { return selector === "a[href]" ? [cta, faq, external] : [cta]; } },
  });
  check(external.href === "https://example.org/", "UTM code must never modify external non-store links");
  return { cta: new URL(cta.href), faq: new URL(faq.href) };
}
check(runCampaign(origin + "/").cta.href === storeUrl, "Default store campaign unchanged");
check(storage.size === 0, "Normal visitors must not create test storage");
check(runCampaign(origin + "/?utm_source=reddit").cta.searchParams.get("utm_source") === "reddit",
  "Inbound UTM labels must be preserved");
check(runCampaign(origin + "/?utm_source=%3Cscript%3E").cta.searchParams.get("utm_source") === "otlfrosta.com",
  "Reject unsafe inbound UTM labels");
const internal = runCampaign(origin + "/?analytics_test=1&utm_source=reddit");
check(internal.cta.searchParams.get("utm_source") === "internal_test" &&
  internal.faq.searchParams.get("utm_medium") === "test", "Test attribution overrides CTA and FAQ links");
check(runCampaign(origin + "/export-all-gemini-chats").cta.searchParams.get("utm_source") === "internal_test",
  "Explicit test mode persists across pages");
check(runCampaign(origin + "/?analytics_test=0").cta.href === storeUrl && storage.size === 0,
  "Explicit reset clears test mode");
check(runCampaign(origin + "/?analytics_test=1", true).cta.searchParams.get("utm_source") === "internal_test",
  "Explicit test mode works even if storage is blocked");
check(runCampaign("https://preview.otlfrosta-web.pages.dev/").cta.searchParams.get("utm_source") === "internal_test",
  "Preview clicks are always internal tests");

if (errors.length) {
  for (const error of errors) console.error("FAIL " + error);
  console.error("Site validation failed: " + errors.length + " error(s)");
  process.exitCode = 1;
} else {
  console.log("Site validation passed: " + htmlFiles.length + " HTML pages, " + checkedLinks + " local links, sitemap, redirects, security headers.");
}
