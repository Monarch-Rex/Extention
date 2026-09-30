/**
 * Interactive Element Scanner - Popup Script
 */

// ── Color map for badge types ──────────────────────────────────────────────
const TYPE_COLORS = {
  textbox:      "var(--badge-textbox)",
  button:       "var(--badge-button)",
  dropdown:     "var(--badge-dropdown)",
  checkbox:     "var(--badge-checkbox)",
  radio:        "var(--badge-radio)",
  link:         "var(--badge-link)",
  file_input:   "var(--badge-file)",
  slider:       "var(--badge-slider)",
  date_input:   "var(--badge-slider)",
  color_picker: "var(--badge-file)",
  tab:          "var(--badge-other)",
  accordion:    "var(--badge-other)",
  toggle:       "var(--badge-checkbox)",
  menu_item:    "var(--badge-other)",
};

// ── State ──────────────────────────────────────────────────────────────────
let allElements = [];
let filteredElements = [];

// ── DOM refs ───────────────────────────────────────────────────────────────
const scanBtn     = document.getElementById("scanBtn");
const copyBtn     = document.getElementById("copyBtn");
const filterInput = document.getElementById("filterInput");
const resultsDiv  = document.getElementById("results");
const countBadge  = document.getElementById("countBadge");
const footerRight = document.getElementById("footerRight");
const emptyState  = document.getElementById("emptyState");

// ── Scan ───────────────────────────────────────────────────────────────────
scanBtn.addEventListener("click", async () => {
  scanBtn.disabled = true;
  scanBtn.textContent = "Scanning…";
  resultsDiv.innerHTML = `<div class="state"><div class="icon">⟳</div><p>Scanning page…</p></div>`;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanPage,
    });

    allElements = result || [];
    filteredElements = [...allElements];

    renderResults(filteredElements);
    updateUI();

  } catch (err) {
    resultsDiv.innerHTML = `
      <div class="state">
        <div class="icon">⚠</div>
        <p>Cannot scan this page.<br/><small>${err.message}</small></p>
      </div>`;
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = "▶ Scan Page";
  }
});

// ── Filter ────────────────────────────────────────────────────────────────
filterInput.addEventListener("input", () => {
  const q = filterInput.value.trim().toLowerCase();
  filteredElements = q
    ? allElements.filter(el =>
        el.type.includes(q) ||
        el.identifier.toLowerCase().includes(q) ||
        (el.label || "").toLowerCase().includes(q)
      )
    : [...allElements];
  renderResults(filteredElements);
  footerRight.textContent = `Showing ${filteredElements.length} / ${allElements.length}`;
});

// ── Copy ──────────────────────────────────────────────────────────────────
copyBtn.addEventListener("click", () => {
  const text = filteredElements
    .map(el => formatLine(el))
    .join("\n");
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = "✓ Copied!";
    setTimeout(() => { copyBtn.textContent = "⎘ Copy"; }, 1500);
  });
});

// ── Render ────────────────────────────────────────────────────────────────
function renderResults(elements) {
  if (!elements.length) {
    resultsDiv.innerHTML = `
      <div class="state">
        <div class="icon">∅</div>
        <p>No interactive elements found.</p>
      </div>`;
    return;
  }

  resultsDiv.innerHTML = "";
  elements.forEach((el, i) => {
    const row = document.createElement("div");
    row.className = "el-row";
    row.style.animationDelay = `${Math.min(i * 20, 300)}ms`;

    const color = TYPE_COLORS[el.type] || "var(--badge-other)";
    const badge = `<span class="type-badge" style="--badge-color:${color}">${el.type}</span>`;

    const line = `<span class="keyword">element</span>: <span class="identifier">${escapeHtml(el.identifier)}</span>`;

    let meta = `<span class="tag">&lt;${el.tagName}${el.inputType ? ` type="${el.inputType}"` : ""}&gt;</span>`;
    if (el.label) meta += ` <span class="label-val">label: "${escapeHtml(el.label)}"</span>`;
    if (el.required) meta += `<span title="Required field" class="required-dot"></span>`;
    if (el.readOnly) meta += ` <span title="Read-only">[readonly]</span>`;
    if (el.options) meta += ` opts: ${el.options.slice(0,3).join(", ")}${el.options.length > 3 ? "…" : ""}`;

    row.innerHTML = `
      ${badge}
      <div class="el-detail">
        <div class="el-line">${line}</div>
        <div class="el-meta">${meta}</div>
      </div>`;
    resultsDiv.appendChild(row);
  });
}

function updateUI() {
  countBadge.style.display = "inline-block";
  countBadge.textContent = allElements.length;
  filterInput.style.display = "block";
  copyBtn.style.display = "inline-block";
  footerRight.textContent = `${allElements.length} element${allElements.length !== 1 ? "s" : ""} found`;
}

function formatLine(el) {
  return `element: ${el.type}(${el.identifier})`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Injected page function (serialized & executed in tab context) ──────────
function scanPage() {
  function getIdentifier(el, index) {
    if (el.id) return el.id;
    if (el.name) return el.name;
    const aria = el.getAttribute("aria-label");
    if (aria) return aria.trim().replace(/\s+/g, "_").substring(0, 40);
    if (el.placeholder) return el.placeholder.trim().replace(/\s+/g, "_").substring(0, 40);
    const text = (el.innerText || el.textContent || "").trim();
    if (text) return text.replace(/\s+/g, "_").substring(0, 40);
    return `unnamed_${index}`;
  }

  function getElementType(el) {
    const tag = el.tagName.toLowerCase();
    const type = (el.type || "").toLowerCase();
    if (tag === "input") {
      const map = {
        text: "textbox", email: "textbox", password: "textbox",
        number: "textbox", tel: "textbox", url: "textbox",
        search: "textbox", "": "textbox",
        checkbox: "checkbox", radio: "radio",
        submit: "button", button: "button", reset: "button",
        file: "file_input", range: "slider", color: "color_picker",
        date: "date_input", "datetime-local": "date_input",
        month: "date_input", week: "date_input", time: "date_input",
      };
      if (type === "hidden") return null;
      return map[type] || `input_${type}`;
    }
    if (tag === "textarea") return "textbox";
    if (tag === "select")   return "dropdown";
    if (tag === "button")   return "button";
    if (tag === "a" && el.href) return "link";
    if (tag === "details")  return "accordion";
    const ce = el.getAttribute("contenteditable");
    if (ce === "true" || ce === "") return "textbox";
    const roleMap = {
      button: "button", link: "link", checkbox: "checkbox",
      radio: "radio", combobox: "dropdown", listbox: "dropdown",
      slider: "slider", spinbutton: "textbox", textbox: "textbox",
      searchbox: "textbox", switch: "toggle", tab: "tab",
      menuitem: "menu_item", menuitemcheckbox: "checkbox",
      menuitemradio: "radio",
    };
    const role = el.getAttribute("role");
    if (role && roleMap[role]) return roleMap[role];
    return null;
  }

  function isUsable(el) {
    if (el.disabled) return false;
    if (el.type === "hidden") return false;
    const s = window.getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    return true;
  }

  function getLabel(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return lbl.innerText.trim();
    }
    const parent = el.closest("label");
    if (parent) return parent.innerText.replace(el.value || "", "").trim();
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const lblEl = document.getElementById(by);
      if (lblEl) return lblEl.innerText.trim();
    }
    return el.getAttribute("aria-label") || null;
  }

  const selector = [
    "input:not([type='hidden'])", "textarea", "select", "button",
    "a[href]", "details",
    "[contenteditable='true']", "[contenteditable='']",
    "[role='button']", "[role='link']", "[role='checkbox']",
    "[role='radio']", "[role='combobox']", "[role='listbox']",
    "[role='slider']", "[role='spinbutton']", "[role='textbox']",
    "[role='searchbox']", "[role='switch']", "[role='tab']",
    "[role='menuitem']",
  ].join(", ");

  const seen = new Set();
  const out = [];
  document.querySelectorAll(selector).forEach((el, i) => {
    if (seen.has(el)) return; seen.add(el);
    const type = getElementType(el);
    if (!type || !isUsable(el)) return;

    const entry = {
      type,
      identifier: getIdentifier(el, i),
      tagName: el.tagName.toLowerCase(),
      inputType: el.type || null,
      label: getLabel(el),
    };

    if (el.tagName.toLowerCase() === "select") {
      entry.options = Array.from(el.options).map(o => o.text).slice(0, 10);
    }
    if (el.type === "checkbox" || el.type === "radio") entry.checked = el.checked;
    if (el.required) entry.required = true;
    if (el.readOnly) entry.readOnly = true;

    out.push(entry);
  });
  return out;
}
