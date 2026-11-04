import { SAMPLE_CHATS, FORMAT_INFO, sampleFiles, zipSampleFiles } from "./demo-data.mjs";

// Faithful visual subset of the actual Gemini Exporter Workbench.
// All chat contents are fictional. No Chrome APIs, requests, tracking or storage.
const root = document.querySelector("[data-demo-root]");
if (root) {
  const $ = selector => root.querySelector(selector);
  const ui = {
    list: $("[data-demo-chat-list]"),
    sync: $("[data-demo-sync]"),
    selectAll: $("[data-demo-select-all]"),
    count: $("[data-demo-count]"),
    selectedCount: $("[data-demo-selected-count]"),
    search: $("[data-demo-search]"),
    filter: $("[data-demo-filter]"),
    format: $("[data-demo-format]"),
    skip: $("[data-demo-skip]"),
    theme: $("[data-demo-theme-toggle]"),
    export: $("[data-demo-export]"),
    result: $("[data-demo-result]"),
    resultSummary: $("[data-demo-result-summary]"),
    resultList: $("[data-demo-result-list]"),
    note: $("[data-demo-result-note]"),
    download: $("[data-demo-download]"),
    reset: $("[data-demo-reset]"),
    loading: $("[data-demo-loading]"),
    status: $("[data-demo-status]")
  };
  const state = {
    synced: false,
    selected: new Set(),
    exported: new Set(),
    format: "markdown",
    filter: "all",
    query: "",
    skip: true,
    dark: false,
    lastExport: null
  };
  const exportedKey = chat => state.format + ":" + chat.id;

  function announce(message) { ui.status.textContent = message; }

  function resetResult() {
    state.lastExport = null;
    ui.result.hidden = true;
    ui.resultList.replaceChildren();
  }

  function visibleChats() {
    if (!state.synced) return [];
    return SAMPLE_CHATS.filter(chat => {
      const matches = (chat.title + " " + chat.id).toLowerCase().includes(state.query);
      const record = state.exported.has(exportedKey(chat));
      return matches && (state.filter === "all" ||
        (state.filter === "has_record" && record) ||
        (state.filter === "no_record" && !record));
    });
  }

  function updateControls(visible) {
    const items = visible ?? visibleChats();
    const selectedVisible = items.filter(chat => state.selected.has(chat.id));
    const allSelected = items.length > 0 && selectedVisible.length === items.length;
    ui.selectAll.disabled = !state.synced || items.length === 0;
    ui.selectAll.checked = allSelected;
    ui.selectAll.indeterminate = selectedVisible.length > 0 && !allSelected;
    ui.selectedCount.textContent = state.synced
      ? state.selected.size + " of " + SAMPLE_CHATS.length + " selected"
      : "0 of 0 selected";
    ui.count.textContent = state.synced
      ? items.length + " visible fictional conversations"
      : "Click Sync All to load sample conversations";
    ui.search.disabled = !state.synced;
    ui.filter.disabled = !state.synced;
    ui.export.disabled = !state.synced || state.selected.size === 0;
    ui.sync.textContent = "Sync All";
  }

  function createRow(chat) {
    const row = document.createElement("label");
    row.className = "demo-chat-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "demo-chat";
    checkbox.value = chat.id;
    checkbox.checked = state.selected.has(chat.id);
    const body = document.createElement("span");
    body.className = "demo-chat-body";
    const title = document.createElement("strong");
    title.className = "demo-chat-title";
    title.textContent = chat.title;
    const date = document.createElement("small");
    date.className = "demo-chat-date";
    date.textContent = chat.dateLabel + " · Example";
    body.append(title, date);
    const record = state.exported.has(exportedKey(chat));
    if (record) {
      const badge = document.createElement("span");
      badge.className = "demo-exported-badge";
      badge.textContent = "Exported";
      badge.setAttribute("aria-label", "Previously exported in this demo");
      body.append(badge);
    }
    const arrow = document.createElement("span");
    arrow.className = "demo-external-arrow";
    arrow.textContent = "↗";
    arrow.setAttribute("aria-hidden", "true");
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selected.add(chat.id);
      else state.selected.delete(chat.id);
      resetResult();
      updateControls();
      announce(state.selected.size + " sample chats selected.");
    });
    row.append(checkbox, body, arrow);
    return row;
  }

  function renderList() {
    const rows = document.createDocumentFragment();
    const visible = visibleChats();
    if (!state.synced || visible.length === 0) {
      const empty = document.createElement("div");
      empty.className = "demo-empty";
      const heading = document.createElement("strong");
      heading.textContent = !state.synced
        ? "Your conversation list appears here"
        : "No conversations match this search or filter";
      const description = document.createElement("p");
      description.textContent = !state.synced
        ? "Click Sync All to load four fictional example chats. The installed extension syncs your real Gemini account."
        : "Try changing the search text or export-status filter.";
      empty.append(heading, description);
      rows.append(empty);
    } else {
      for (const chat of visible) rows.append(createRow(chat));
    }
    ui.list.replaceChildren(rows);
    updateControls(visible);
  }

  ui.sync.addEventListener("click", () => {
    if (!state.synced) {
      state.selected = new Set(SAMPLE_CHATS.map(chat => chat.id));
      state.synced = true;
    }
    resetResult();
    renderList();
    announce("Sync complete: four fictional conversations loaded.");
  });

  ui.selectAll.addEventListener("change", () => {
    for (const chat of visibleChats()) {
      if (ui.selectAll.checked) state.selected.add(chat.id);
      else state.selected.delete(chat.id);
    }
    resetResult();
    renderList();
    announce(state.selected.size + " sample chats selected.");
  });

  ui.search.addEventListener("input", () => {
    state.query = ui.search.value.trim().toLowerCase();
    resetResult();
    renderList();
  });

  ui.filter.addEventListener("change", () => {
    state.filter = ui.filter.value;
    resetResult();
    renderList();
  });

  ui.format.addEventListener("change", () => {
    if (!Object.hasOwn(FORMAT_INFO, ui.format.value)) return;
    state.format = ui.format.value;
    resetResult();
    renderList();
    announce(FORMAT_INFO[state.format].label + " format selected.");
  });

  ui.skip.addEventListener("change", () => {
    state.skip = ui.skip.checked;
    resetResult();
    announce(state.skip ? "Skip exported enabled." : "Re-exporting saved sample chats is allowed.");
  });

  ui.theme.addEventListener("click", () => {
    state.dark = !state.dark;
    root.dataset.theme = state.dark ? "dark" : "light";
    ui.theme.textContent = state.dark ? "☀" : "☾";
    ui.theme.setAttribute("aria-label", "Switch demo to " + (state.dark ? "light" : "dark") + " theme");
    announce(state.dark ? "Dark Workbench preview." : "Light Workbench preview.");
  });

  ui.export.addEventListener("click", () => {
    if (!state.synced || state.selected.size === 0) return;
    const chosen = SAMPLE_CHATS.filter(chat => state.selected.has(chat.id));
    const toExport = state.skip ? chosen.filter(chat => !state.exported.has(exportedKey(chat))) : chosen;
    const files = sampleFiles(toExport.map(chat => chat.id), state.format);
    state.lastExport = files.length ? { ids: toExport.map(chat => chat.id), format: state.format } : null;
    ui.resultList.replaceChildren();
    for (const file of files) {
      const row = document.createElement("div");
      row.className = "demo-output-file";
      const icon = document.createElement("span");
      icon.textContent = "▤";
      icon.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.textContent = file.name;
      const ext = document.createElement("small");
      ext.textContent = FORMAT_INFO[state.format].extension.toUpperCase();
      row.append(icon, name, ext);
      ui.resultList.append(row);
    }
    ui.result.hidden = false;
    ui.resultSummary.textContent = files.length + " example " + (files.length === 1 ? "file" : "files") + " prepared";
    ui.download.hidden = state.format === "pdf" || files.length === 0;
    ui.note.textContent = files.length === 0
      ? "All selected samples have already been exported in this format. Uncheck Skip exported to try again."
      : state.format === "pdf"
        ? "PDF filenames are illustrative; use the actual extension to generate PDF files."
        : "Download a ZIP of these fictional sample documents. Actual export files may differ.";
    for (const chat of toExport) state.exported.add(exportedKey(chat));
    renderList();
    announce(files.length + " sample documents prepared. No real Gemini chats accessed.");
  });

  ui.download.addEventListener("click", () => {
    const current = state.lastExport;
    if (!current || current.format === "pdf" || ui.result.hidden) return;
    const files = sampleFiles(current.ids, current.format);
    const zip = zipSampleFiles(files);
    const url = URL.createObjectURL(new Blob([zip], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "gemini-exporter-example-" + current.format + ".zip";
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    announce("Fictional example ZIP download started.");
  });

  ui.reset.addEventListener("click", () => {
    state.synced = false;
    state.selected.clear();
    state.exported.clear();
    state.format = "markdown";
    state.filter = "all";
    state.query = "";
    state.skip = true;
    ui.format.value = "markdown";
    ui.filter.value = "all";
    ui.search.value = "";
    ui.skip.checked = true;
    resetResult();
    renderList();
    announce("Demo reset. Click Sync All to try the Workbench again.");
  });

  root.dataset.ready = "true";
  ui.loading.hidden = true;
  renderList();
}
