#!/usr/bin/env node
// Validate the deployable Cloudflare Pages directory without dependencies or network access.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

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
  "index.html", "privacy.html", "website-privacy.html",
  "styles.css", "privacy.css", "utm.js",
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

check(read("index.html").match(/data-store-cta/g)?.length >= 2, "Expected two Chrome Web Store CTAs");

if (errors.length) {
  for (const error of errors) console.error("FAIL " + error);
  console.error("Site validation failed: " + errors.length + " error(s)");
  process.exitCode = 1;
} else {
  console.log("Site validation passed: " + htmlFiles.length + " HTML pages, " + checkedLinks + " local links, sitemap, redirects, security headers.");
}
