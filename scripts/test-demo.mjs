import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SAMPLE_CHATS, FORMAT_INFO, selectedChats, sampleFiles, zipSampleFiles } from "../public/demo-data.mjs";

function storedEntries(zip) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const decoder = new TextDecoder();
  const output = [];
  let offset = 0;
  while (offset + 30 <= zip.length && view.getUint32(offset, true) === 0x04034b50) {
    assert.equal(view.getUint16(offset + 8, true), 0, "ZIP uses STORE, no dependency");
    assert.equal(view.getUint16(offset + 6, true), 0x0800, "UTF-8 names");
    const size = view.getUint32(offset + 18, true);
    assert.equal(size, view.getUint32(offset + 22, true));
    const filenameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const start = offset + 30 + filenameLength + extraLength;
    const name = decoder.decode(zip.subarray(offset + 30, offset + 30 + filenameLength));
    const data = decoder.decode(zip.subarray(start, start + size));
    output.push({ name, data, crc: view.getUint32(offset + 14, true) });
    offset = start + size;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50, "central directory follows local files");
  const eocd = zip.byteLength - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, "ZIP end-of-central-directory signature");
  assert.equal(view.getUint16(eocd + 8, true), output.length);
  assert.equal(view.getUint16(eocd + 10, true), output.length);
  assert.equal(view.getUint32(eocd + 16, true), offset);
  assert.equal(view.getUint32(eocd + 12, true), eocd - offset);
  return output;
}

test("demo has four fictional chats with distinct IDs and filenames", () => {
  assert.equal(SAMPLE_CHATS.length, 4);
  assert.equal(new Set(SAMPLE_CHATS.map(x => x.id)).size, 4);
  assert.equal(new Set(SAMPLE_CHATS.map(x => x.slug)).size, 4);
  for (const chat of SAMPLE_CHATS) {
    assert.equal(chat.messages.length, 2);
    assert.ok(chat.title);
    assert.equal(chat.messages[0].role, "user");
  }
});

test("selection preserves sample ordering, rejects duplicates and foreign identifiers", () => {
  assert.deepEqual(selectedChats(["design", "travel"]).map(x => x.id), ["travel", "design"]);
  assert.deepEqual(selectedChats([]), []);
  assert.throws(() => selectedChats(["invalid"]));
  assert.throws(() => selectedChats(["travel", "travel"]));
  assert.throws(() => selectedChats("travel"));
});

test("render Markdown, HTML, JSON and PDF names without inventing real conversation data", () => {
  for (const format of Object.keys(FORMAT_INFO)) {
    const files = sampleFiles(["infrastructure", "travel"], format);
    assert.equal(files.length, 2);
    assert.ok(files.every(x => x.name.endsWith("." + FORMAT_INFO[format].extension)));
    assert.notEqual(files[0].name, files[1].name);
    if (format === "pdf") {
      assert.ok(files.every(x => x.content === null), "PDF is filename preview only");
      continue;
    }
    assert.ok(files.every(x => x.content.includes("Example conversation")));
    if (format === "html") {
      assert.match(files[0].content, /<html lang="en">/);
      assert.match(files[0].content, /<h1>AI infrastructure notes<\/h1>/);
    } else if (format === "markdown") {
      assert.match(files[0].content, /^# AI infrastructure notes/);
      assert.match(files[0].content, /## Gemini/);
    } else {
      const parsed = JSON.parse(files[0].content);
      assert.equal(parsed.messages.length, 2);
      assert.match(parsed.note, /Not a real Gemini chat/);
    }
  }
});

test("generated ZIP holds separate readable files for each selected sample chat", () => {
  for (const format of ["markdown", "html", "json"]) {
    const files = sampleFiles(SAMPLE_CHATS.map(x => x.id), format);
    const zip = zipSampleFiles(files);
    const decoded = storedEntries(zip);
    assert.deepEqual(decoded.map(x => x.name), files.map(x => x.name));
    assert.deepEqual(decoded.map(x => x.data), files.map(x => x.content));
  }
});

test("ZIP CRC32 follows standard polynomial, rejects invalid files and PDF preview", () => {
  const data = storedEntries(zipSampleFiles([{ name: "test.md", content: "123456789" }]));
  assert.equal(data[0].crc, 0xcbf43926);
  assert.throws(() => zipSampleFiles([]));
  assert.throws(() => zipSampleFiles([{ name: "../malicious.md", content: "bad" }]));
  assert.throws(() => zipSampleFiles([{ name: "duplicate.md", content: "1" }, { name: "duplicate.md", content: "2" }]));
  assert.throws(() => zipSampleFiles(sampleFiles(["design"], "pdf")), /Invalid sample document/);
});

test("homepage demo uses only first-party assets, clear disclosure and accessible inputs", () => {
  const file = fileURLToPath(new URL("../public/index.html", import.meta.url));
  const html = readFileSync(file, "utf8");
  assert.match(html, /id="try-demo"/);
  assert.match(html, /data-demo-root data-ready="false"/);
  assert.match(html, /src="\/demo\.js\?v=/);
  assert.match(html, /href="\/demo\.css\?v=/);
  assert.match(html, /data-demo-format/);
  assert.match(html, /data-demo-search/);
  assert.match(html, /data-demo-filter/);
  assert.match(html, /data-demo-skip/);
  assert.match(html, /data-demo-account/);
  assert.match(html, /data-demo-theme-toggle/);
  assert.match(html, /data-demo-sync/);
  assert.match(html, /data-demo-select-all/);
  assert.match(html, /data-demo-export/);
  assert.match(html, /data-demo-result/);
  assert.match(html, /data-demo-download/);
  assert.match(html, /data-demo-status role="status" aria-live="polite"/);
  assert.match(html, /fictional chats/i);
  assert.doesNotMatch(html, /class="hero-workflow"/);
});

test("demo JavaScript uses no network requests, storage, or privileged extension APIs", () => {
  const source = readFileSync(new URL("../public/demo.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\blocalStorage\b|\bsessionStorage\b|\bchrome\s*\.\s*(?:tabs|runtime|downloads|storage)\b/);
  assert.match(source, /textContent/);
  assert.match(source, /new Blob/);
  assert.match(source, /URL\.revokeObjectURL/);
});

test("demo follows the real Workbench panel order, labels and control groups", () => {
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../public/demo.css", import.meta.url), "utf8");
  const settings = html.indexOf('class="demo-settings-pane"');
  const conversations = html.indexOf('class="demo-list-pane"');
  assert.ok(settings > 0 && conversations > settings, "real extension has settings on the left and chats on the right");
  for (const label of ["Format", "Skip exported", "Export to", "Browser download", "Save to local folder",
    "Live Save", "Export selected", "Sync All", "Search title / ID...", "Not exported", "Exported"]) {
    assert.ok(html.includes(label), "missing real Workbench control: " + label);
  }
  assert.match(css, /\.demo-workbench\s*\{[^}]*grid-template-columns:/);
  assert.match(css, /\.hero-demo\[data-theme="dark"\]/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(html, /disabled><span><strong>Save to local folder/);
});

test("demo search, per-format export history and Skip exported are implemented as real interactions", () => {
  const source = readFileSync(new URL("../public/demo.js", import.meta.url), "utf8");
  assert.match(source, /data-demo-search/);
  assert.match(source, /data-demo-filter/);
  assert.match(source, /state\.exported\.has/);
  assert.match(source, /state\.skip \?/);
  assert.match(source, /addEventListener\("input"/);
  assert.match(source, /addEventListener\("change"/);
});
