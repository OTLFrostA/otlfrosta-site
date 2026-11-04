# Product homepage — otlfrosta.com

A static, privacy-preserving landing page managed in this standalone repository (`main` branch). The browser extension lives in `OTLFrostA/gemini-exporter`.

## Messaging and layout

1. Free, open source, and **local-only processing**, no developer server for chat uploads, subscriptions or telemetry.
2. **Bulk export** of accessible Gemini history, using Sync All → select all → Export selected. Supported formats: Markdown, PDF, HTML, JSON. Original source files are included when still available.
3. **Background Live Save** that updates local Markdown backups after new Gemini replies while browsing.

Each benefit has one explanatory paragraph and one visual: a diagram, authentic workbench screenshot, or a Live Save conceptual diagram. The diagrams are illustrations, not screenshots. Do not make images clickable or show a test-account caption.

Preserve a practical FAQ with real current button names and content about batch exports, slow or interrupted exports, Skip exported, large Gemini histories, Google Takeout ZIP import, local privacy, formats/attachments, and current platform support. FAQ wording should match the published extension and user guide in `OTLFrostA/gemini-exporter` (`main`).

## Search-intent guides and homepage design

The homepage is a direct entry point for Google Gemini users, not a generic multi-platform product claim. It presents the three-step `Sync All → choose conversations → Export selected` flow, a clearly labeled illustrative output tree, an authentic Workbench screenshot, and four task-specific guides:

| Clean URL | Static source | Search intent |
| --- | --- | --- |
| `/export-all-gemini-chats` | `public/export-all-gemini-chats.html` | Bulk export all chats, skip completed exports |
| `/import-google-takeout-gemini` | `public/import-google-takeout-gemini.html` | Import official Google Takeout ZIP, convert archives |
| `/automatic-gemini-chat-backup` | `public/automatic-gemini-chat-backup.html` | Set up local Markdown Live Save |
| `/export-gemini-chat-formats` | `public/export-gemini-chat-formats.html` | Compare and export PDF, Markdown, HTML, JSON |

These are useful how-to pages, **not claims of support for unshipped features**. Published Chrome Web Store support is Gemini; other platform integrations are experimental. Live Save writes Markdown only, and only during active browser use with local-folder permissions. Attachment availability is conditional; scanning alone does not create a backup. Do not copy Extry's product claims (e.g. independent archive index, Word/Excel export, server typeset PDF) into Gemini Exporter without implementation and verification.

Page design is shared through `public/styles.css` and `public/guides.css`, with no external libraries or fonts. Each page must keep a unique title, meta description, self canonical URL, OG metadata, semantic headings, relevant Workbench terminology, internal links, privacy claims and honest limitations. When adding a page, link it from the homepage/other guides and add it to `public/sitemap.xml`. Keep `public/_headers`, privacy pages and `public/utm.js` behavior intact. Each guide's Chrome Web Store CTA carries a page-specific default `utm_campaign` while preserving validated inbound campaign parameters.

## Deploy via Cloudflare Pages

- Project: `otlfrosta-web`
- Repo: `OTLFrostA/otlfrosta-site`
- Production branch: `main`
- Framework: None; deployable output directory: `public` (Cloudflare build validation retained for Git previews; production upload is done by GitHub Actions)
- PR preview branches: Cloudflare Git integration may create previews; GitHub Actions owns all production deployments, with Cloudflare native production auto-deploy disabled
- Site URL: `https://otlfrosta-web.pages.dev`
- Domain migration pending: `otlfrosta.com` and `www.otlfrosta.com` still point to the old `otlfrosta-site` Pages project until explicitly transferred

The Cloudflare zone has **Web Analytics auto-injection enabled** (EU Lite mode excludes EU visitor metrics). The site uses no analytics cookies, local visitor IDs, or fingerprinting. `public/_headers` strictly allows only Cloudflare's beacon script and same-origin `/cdn-cgi/rum` reporting. No GA4 script, consent banner, external fonts, or extension telemetry. A tiny local first-party script (`public/utm.js`) copies inbound UTM values to both Chrome Web Store CTA URLs without network calls.

## X Bio short URL and attribution

- `https://otlfrosta.com/x` responds with HTTP 302 to `https://otlfrosta.com/?utm_source=twitter&utm_medium=social&utm_campaign=x_bio` via `public/_redirects`.
- The homepage CTA buttons read `utm_source`, `utm_medium`, and `utm_campaign` directly from the current URL and pass them through to the Chrome Web Store link. Values must be short ASCII campaign tokens. No cookies, local storage, or extra requests from **the UTM pass-through script itself**; Cloudflare's independently configured Web Analytics beacon is separate.
- When there are no incoming UTM parameters, existing default `utm_source=otlfrosta.com&utm_medium=website&utm_campaign=hero|footer` remains unchanged.
- For new source-specific entry points, define a new path rule in `public/_redirects`, no DNS record required. Website changes belong here, not in the extension repository.

This tracks campaign-level Chrome Web Store visits and installs, not X post impressions or cross-site user identities.

## Separate privacy policies

- **Chrome Web Store Privacy Policy URL:** `https://otlfrosta.com/privacy` (`public/privacy.html`) describes the browser extension's local-only processing, local storage, permissions and source-service requests. It is linked from the homepage's extension privacy FAQ.
- **Website privacy:** `https://otlfrosta.com/website-privacy` (`public/website-privacy.html`) describes Cloudflare-hosted website analytics, infrastructure processing, and campaign URL pass-through. It is linked from the homepage footer.
- Both pages have English and Simplified Chinese sections and a two-link policy switcher (plain links; no JavaScript tabs).
- Keep extension claims aligned with [`OTLFrostA/gemini-exporter/docs/PRIVACY_POLICY.md`](https://github.com/OTLFrostA/gemini-exporter/blob/main/docs/PRIVACY_POLICY.md) when the extension changes, and website analytics claims aligned with Cloudflare's live RUM/EU Lite configuration. The two static pages are independent snapshots rather than a new build-time dependency.
- `public/privacy.css` styles both policy pages; it does not affect the homepage.

## CI/CD (merge to deploy)

- Source of truth: `OTLFrostA/otlfrosta-site` `main`.
- `.github/workflows/site-ci.yml` runs `Validate static site` for every PR and push to `main`. It validates syntax, internal links/assets, anchors, canonical URLs, sitemap, privacy policies, redirects and security headers.
- On pushes to `main` **after validation succeeds**, the same GitHub Actions workflow runs `Deploy to Cloudflare Pages` using `cloudflare/wrangler-action@v4` and `pages deploy public --project-name=otlfrosta-web --branch=main`.
- The deploy job uses GitHub Actions **environment `production`**. Store `CLOUDFLARE_API_TOKEN` (Cloudflare Pages Edit permission for the website account) and `CLOUDFLARE_ACCOUNT_ID` as that environment's secrets. Only the deploy job receives these values; PR validation does not. Do not commit API tokens or expose them in logs.
- Cloudflare's **native production Git auto-deployment is disabled** to avoid duplicate deployments. The Pages project remains Git-connected, and optional PR previews do not publish production releases.
- Workflow deployment runs are serialized for the production project. No tag or manual upload is required for normal website updates; merges deploy automatically after CI.
- GitHub branch protection requiring `Validate static site` is recommended, if supported by repository rules.
- The website custom-domain transfer is a separate operation: `otlfrosta.com` and `www.otlfrosta.com` stay bound to the original Pages project until a validated cutover.

## Release verification

After a website change is pushed to `main`, confirm that Cloudflare Pages `otlfrosta-web` created a successful production deployment. Check `/`, `/privacy`, `/website-privacy`, `/robots.txt`, `/sitemap.xml`, campaign redirects such as `/x`, image and CSS assets, and the Cloudflare Web Analytics configuration. Keep the public URL and canonical metadata stable during hosting migrations.
