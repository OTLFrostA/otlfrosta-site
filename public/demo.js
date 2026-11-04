import { SAMPLE_CHATS, FORMAT_INFO, sampleFiles, zipSampleFiles } from "./demo-data.mjs";

// A marketing demo, not a Chrome extension. Fixed, clearly labeled sample data only.
// No fetch, analytics, storage, account access, permissions, or external dependencies.
const root = document.querySelector("[data-demo-root]");
if (root) {
  const $ = (selector) => root.querySelector(selector);
  const list = $("[data-demo-chat-list]");
  const sync = $("[data-demo-sync]");
  const selectAll = $("[data-demo-select-all]");
  const count = $("[data-demo-count]");
  const selectedCount = $("[data-demo-selected-count]");
  const status = $("[data-demo-status]");
  const exportButton = $("[data-demo-export]");
  const result = $("[data-demo-result]");
  const resultSummary = $("[data-demo-result-summary]");
  const resultList = $("[data-demo-result-list]");
  const download = $("[data-demo-download]");
  const resultNote = $("[data-demo-result-note]");
  const reset = $("[data-demo-reset]");
  const loading = $("[data-demo-loading]");
  const formats = [...root.querySelectorAll('input[name="demo-format"]')];
  const state = {
    synced: false,
    selected: new Set(),
    format: "markdown"
  };

  function announce(message) {
    status.textContent = message;
  }

  function clearResult() {
    result.hidden = true;
    resultList.replaceChildren();
  }

  function updateControls() {
    count.textContent = state.synced
      ? SAMPLE_CHATS.length + " example conversations"
      : "Click Sync All to load sample conversations";
    selectedCount.textContent = state.selected.size + " selected";
    sync.textContent = state.synced ? "↻ Sync again" : "↻ Sync All";
    selectAll.disabled = !state.synced;
    selectAll.checked = state.synced && state.selected.size === SAMPLE_CHATS.length;
    selectAll.indeterminate = state.synced && state.selected.size > 0 &&
      state.selected.size < SAMPLE_CHATS.length;
    exportButton.disabled = !state.synced || state.selected.size === 0;
    exportButton.textContent = state.selected.size > 0
      ? "Export " + state.selected.size + " selected ↗"
      : "Export selected ↗";
  }

  function addChatRow(chat) {
    const label = document.createElement("label");
    label.className = "demo-chat" + (state.selected.has(chat.id) ? " is-selected" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "demo-sample-chat";
    checkbox.value = chat.id;
    checkbox.checked = state.selected.has(chat.id);

    const icon = document.createElement("span");
    icon.className = "demo-chat-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "✧";

    const body = document.createElement("span");
    body.className = "demo-chat-body";
    const title = document.createElement("span");
    title.className = "demo-chat-title";
    title.textContent = chat.title;
    const snippet = document.createElement("span");
    snippet.className = "demo-chat-snippet";
    snippet.textContent = chat.subtitle;
    body.append(title, snippet);

    const date = document.createElement("span");
    date.className = "demo-chat-date";
    date.textContent = chat.dateLabel;

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selected.add(chat.id);
      else state.selected.delete(chat.id);
      label.classList.toggle("is-selected", checkbox.checked);
      clearResult();
      updateControls();
      announce(state.selected.size + " sample conversations selected.");
    });
    label.append(checkbox, icon, body, date);
    return label;
  }

  function renderChats() {
    const rows = document.createDocumentFragment();
    if (!state.synced) {
      const empty = document.createElement("div");
      empty.className = "demo-empty";
      const symbol = document.createElement("span");
      symbol.className = "demo-empty-icon";
      symbol.setAttribute("aria-hidden", "true");
      symbol.textContent = "↻";
      const title = document.createElement("strong");
      title.textContent = "Discover your conversations";
      const hint = document.createElement("p");
      hint.textContent = "Click Sync All to load four fictional example chats.";
      empty.append(symbol, title, hint);
      rows.append(empty);
    } else {
      for (const chat of SAMPLE_CHATS) rows.append(addChatRow(chat));
    }
    list.replaceChildren(rows);
  }

  function showExport() {
    if (!state.synced || state.selected.size === 0) return;
    const ids = [...state.selected];
    const files = sampleFiles(ids, state.format);
    const ext = FORMAT_INFO[state.format].extension;
    resultList.replaceChildren();
    for (const file of files) {
      const row = document.createElement("div");
      row.className = "demo-output-file";
      const icon = document.createElement("span");
      icon.textContent = "▤";
      icon.setAttribute("aria-hidden", "true");
      const filename = document.createElement("span");
      filename.textContent = file.name;
      const suffix = document.createElement("small");
      suffix.textContent = ext.toUpperCase();
      row.append(icon, filename, suffix);
      resultList.append(row);
    }
    result.hidden = false;
    resultSummary.textContent = files.length + " sample " +
      (files.length === 1 ? "file" : "files") + " · " + FORMAT_INFO[state.format].label;
    download.hidden = state.format === "pdf";
    download.textContent = "Download example ZIP ↓";
    resultNote.textContent = state.format === "pdf"
      ? "PDF filenames are illustrative here. The Chrome extension generates actual PDF files."
      : "These are simplified, fictional sample documents. The real extension uses its own export renderer.";
    announce("Preview ready: " + files.length + " example " + (files.length === 1 ? "file." : "files."));
  }

  sync.addEventListener("click", () => {
    if (!state.synced) {
      state.selected = new Set(SAMPLE_CHATS.slice(0, 3).map(chat => chat.id));
    }
    state.synced = true;
    clearResult();
    renderChats();
    updateControls();
    announce(SAMPLE_CHATS.length + " fictional conversations synced. Select the ones to export.");
  });

  reset.addEventListener("click", () => {
    state.synced = false;
    state.selected.clear();
    state.format = "markdown";
    for (const radio of formats) radio.checked = radio.value === "markdown";
    clearResult();
    renderChats();
    updateControls();
    announce("Demo reset. Click Sync All to get started.");
  });

  selectAll.addEventListener("change", () => {
    state.selected = new Set(selectAll.checked ? SAMPLE_CHATS.map(chat => chat.id) : []);
    clearResult();
    renderChats();
    updateControls();
    announce(state.selected.size + " sample conversations selected.");
  });

  for (const radio of formats) {
    radio.addEventListener("change", () => {
      if (!radio.checked || !Object.hasOwn(FORMAT_INFO, radio.value)) return;
      state.format = radio.value;
      clearResult();
      announce(FORMAT_INFO[radio.value].label + " format selected.");
    });
  }

  exportButton.addEventListener("click", showExport);

  download.addEventListener("click", () => {
    if (!state.synced || state.selected.size === 0 || state.format === "pdf" || result.hidden) return;
    const files = sampleFiles([...state.selected], state.format);
    const zip = zipSampleFiles(files);
    const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "gemini-exporter-example-" + state.format + ".zip";
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    announce("Example ZIP download started. No real Gemini chats were accessed.");
  });

  root.dataset.ready = "true";
  loading.hidden = true;
  renderChats();
  updateControls();
}
