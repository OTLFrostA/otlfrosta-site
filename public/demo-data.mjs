// Standalone, illustrative data only. No user information, network calls or extension APIs.
// Browser and Node share this pure module so sample exports can be tested without a DOM.
export const SAMPLE_CHATS = Object.freeze([
  Object.freeze({
    id: "infrastructure",
    slug: "ai-infrastructure-notes",
    title: "AI infrastructure notes",
    subtitle: "GPU scheduling, queues and reliability",
    dateLabel: "Today",
    messages: [
      { role: "user", text: "What should we measure when designing a GPU job scheduler?" },
      { role: "assistant", text: "Start with queue latency, GPU utilization, job completion rate, and recovery time. Track tail latency as well as averages." }
    ]
  }),
  Object.freeze({
    id: "travel",
    slug: "weekend-travel-plan",
    title: "Weekend travel plan",
    subtitle: "A simple two-day itinerary",
    dateLabel: "Yesterday",
    messages: [
      { role: "user", text: "Help me plan a relaxed weekend in a new city." },
      { role: "assistant", text: "Choose one neighborhood for each day. Leave time for spontaneous stops, and keep a short list of places to visit." }
    ]
  }),
  Object.freeze({
    id: "python",
    slug: "python-debugging",
    title: "Python debugging",
    subtitle: "Finding a slow async call",
    dateLabel: "Oct 28",
    messages: [
      { role: "user", text: "Why are several independent async requests running slowly?" },
      { role: "assistant", text: "Check whether requests are awaited one after another. Independent operations can sometimes run concurrently with bounded limits." }
    ]
  }),
  Object.freeze({
    id: "design",
    slug: "product-design-ideas",
    title: "Product design ideas",
    subtitle: "Notes about a simple landing page",
    dateLabel: "Oct 27",
    messages: [
      { role: "user", text: "What makes a landing page easier to understand?" },
      { role: "assistant", text: "Show the actual workflow and an example result. Put the main action near the headline, with honest feature boundaries." }
    ]
  })
]);

export const FORMAT_INFO = Object.freeze({
  markdown: Object.freeze({ label: "Markdown", extension: "md", mime: "text/markdown" }),
  html: Object.freeze({ label: "HTML", extension: "html", mime: "text/html" }),
  json: Object.freeze({ label: "JSON", extension: "json", mime: "application/json" }),
  pdf: Object.freeze({ label: "PDF", extension: "pdf", mime: "application/pdf" })
});

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function selectedChats(ids) {
  if (!Array.isArray(ids) || ids.some(id => typeof id !== "string")) {
    throw new TypeError("Expected an array of sample chat IDs.");
  }
  const wanted = new Set(ids);
  if (wanted.size !== ids.length || wanted.size > SAMPLE_CHATS.length ||
      [...wanted].some(id => !SAMPLE_CHATS.some(chat => chat.id === id))) {
    throw new Error("Unknown or duplicate sample chat ID.");
  }
  return SAMPLE_CHATS.filter(chat => wanted.has(chat.id));
}

function formatSample(chat, format) {
  if (format === "markdown") {
    return "# " + chat.title + "\n\n" +
      "_Example conversation supplied by Gemini Exporter. Not a real Gemini chat._\n\n" +
      chat.messages.map(message => "## " + (message.role === "user" ? "You" : "Gemini") +
        "\n\n" + message.text).join("\n\n") + "\n";
  }
  if (format === "html") {
    const sections = chat.messages.map(message =>
      '<section><h2>' + (message.role === "user" ? "You" : "Gemini") +
      '</h2><p>' + escapeHtml(message.text) + "</p></section>").join("\n");
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">' +
      "<title>" + escapeHtml(chat.title) + "</title>" +
      '<style>body{font-family:system-ui,sans-serif;max-width:52rem;margin:4rem auto;' +
      'padding:0 1.5rem;line-height:1.65;color:#1c2430}section{margin:2rem 0;' +
      'padding:1rem 1.5rem;border:1px solid #e2e6ed;border-radius:12px}' +
      'h2{font-size:1rem;color:#5b6476}</style></head><body>' +
      "<h1>" + escapeHtml(chat.title) + "</h1>" +
      "<p><em>Example conversation. Not a real Gemini chat.</em></p>\n" +
      sections + "\n</body></html>\n";
  }
  if (format === "json") {
    return JSON.stringify({
      note: "Example conversation. Not a real Gemini chat or an exact schema export.",
      title: chat.title,
      messages: chat.messages
    }, null, 2) + "\n";
  }
  throw new Error("No downloadable sample document for " + format + ".");
}

export function sampleFiles(ids, format) {
  if (!Object.hasOwn(FORMAT_INFO, format)) throw new Error("Unknown sample export format.");
  const chats = selectedChats(ids);
  return chats.map(chat => ({
    name: chat.slug + "." + FORMAT_INFO[format].extension,
    content: format === "pdf" ? null : formatSample(chat, format)
  }));
}

// A tiny, uncompressed ZIP writer for four small, fixed demo documents.
// The real extension's exporter does NOT use this sample-only implementation.
function write16(buffer, offset, value) {
  buffer[offset] = value & 255;
  buffer[offset + 1] = (value >>> 8) & 255;
}
function write32(buffer, offset, value) {
  write16(buffer, offset, value);
  write16(buffer, offset + 2, value >>> 16);
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function concat(parts) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function zipSampleFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > SAMPLE_CHATS.length) {
    throw new Error("Select between one and four sample documents.");
  }
  const decoder = new TextEncoder();
  const locals = [];
  const central = [];
  const seenNames = new Set();
  let localOffset = 0;
  for (const file of files) {
    if (!file || typeof file.name !== "string" || typeof file.content !== "string" ||
        !/^[a-z0-9-]+\.(md|html|json)$/.test(file.name) ||
        seenNames.has(file.name) || file.content.length > 100000) {
      throw new Error("Invalid sample document.");
    }
    seenNames.add(file.name);
    const filename = decoder.encode(file.name);
    const bytes = decoder.encode(file.content);
    const checksum = crc32(bytes);
    const header = new Uint8Array(30 + filename.length + bytes.length);
    write32(header, 0, 0x04034b50);
    write16(header, 4, 20);
    write16(header, 6, 0x0800);
    write16(header, 8, 0);
    write16(header, 12, 33); // 1980-01-01 in MS-DOS date format
    write32(header, 14, checksum);
    write32(header, 18, bytes.length);
    write32(header, 22, bytes.length);
    write16(header, 26, filename.length);
    header.set(filename, 30);
    header.set(bytes, 30 + filename.length);
    locals.push(header);

    const cd = new Uint8Array(46 + filename.length);
    write32(cd, 0, 0x02014b50);
    write16(cd, 4, 20);
    write16(cd, 6, 20);
    write16(cd, 8, 0x0800);
    write16(cd, 14, 33);
    write32(cd, 16, checksum);
    write32(cd, 20, bytes.length);
    write32(cd, 24, bytes.length);
    write16(cd, 28, filename.length);
    write32(cd, 42, localOffset);
    cd.set(filename, 46);
    central.push(cd);
    localOffset += header.length;
  }
  const cdBytes = concat(central);
  const end = new Uint8Array(22);
  write32(end, 0, 0x06054b50);
  write16(end, 8, files.length);
  write16(end, 10, files.length);
  write32(end, 12, cdBytes.length);
  write32(end, 16, localOffset);
  return concat([...locals, cdBytes, end]);
}
