/**
 * Interactive Element Scanner - Content Script
 * Finds all interactive elements in the DOM and returns structured data.
 */

function scanInteractiveElements() {
  const results = [];

  /**
   * Get the best identifier for an element.
   * Priority: id > name > aria-label > placeholder > text content > index fallback
   */
  function getIdentifier(el, index) {
    if (el.id) return el.id;
    if (el.name) return el.name;
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim().replace(/\s+/g, "_");
    if (el.placeholder) return el.placeholder.trim().replace(/\s+/g, "_").substring(0, 30);
    const text = el.innerText || el.textContent;
    if (text && text.trim()) return text.trim().replace(/\s+/g, "_").substring(0, 30);
    return `unnamed_${index}`;
  }

  /**
   * Resolve element type label from tag + input type.
   */
  function getElementType(el) {
    const tag = el.tagName.toLowerCase();
    const type = (el.type || "").toLowerCase();

    if (tag === "input") {
      switch (type) {
        case "text":
        case "email":
        case "password":
        case "number":
        case "tel":
        case "url":
        case "search":
        case "":         return "textbox";
        case "checkbox":  return "checkbox";
        case "radio":     return "radio";
        case "submit":
        case "button":
        case "reset":     return "button";
        case "file":      return "file_input";
        case "range":     return "slider";
        case "color":     return "color_picker";
        case "date":
        case "datetime-local":
        case "month":
        case "week":
        case "time":      return "date_input";
        case "hidden":    return null; // skip hidden inputs
        default:          return `input_${type}`;
      }
    }

    if (tag === "textarea")  return "textbox";
    if (tag === "select")    return "dropdown";
    if (tag === "button")    return "button";
    if (tag === "a" && el.href && el.href !== "#") return "link";
    if (tag === "details")   return "accordion";
    if (tag === "dialog")    return "dialog";

    // Catch contenteditable divs/spans
    if (el.getAttribute("contenteditable") === "true" || el.getAttribute("contenteditable") === "") {
      return "textbox";
    }

    // ARIA roles
    const role = el.getAttribute("role");
    const ariaRoleMap = {
      button: "button",
      link: "link",
      checkbox: "checkbox",
      radio: "radio",
      combobox: "dropdown",
      listbox: "dropdown",
      slider: "slider",
      spinbutton: "textbox",
      textbox: "textbox",
      searchbox: "textbox",
      switch: "toggle",
      tab: "tab",
      menuitem: "menu_item",
      menuitemcheckbox: "checkbox",
      menuitemradio: "radio",
    };
    if (role && ariaRoleMap[role]) return ariaRoleMap[role];

    return null;
  }

  /**
   * Check if element is visible and not disabled.
   */
  function isUsable(el) {
    if (el.disabled) return false;
    if (el.type === "hidden") return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  // All selectors that might be interactive
  const selector = [
    "input", "textarea", "select", "button",
    "a[href]", "details", "dialog",
    "[contenteditable='true']", "[contenteditable='']",
    "[role='button']", "[role='link']", "[role='checkbox']",
    "[role='radio']", "[role='combobox']", "[role='listbox']",
    "[role='slider']", "[role='spinbutton']", "[role='textbox']",
    "[role='searchbox']", "[role='switch']", "[role='tab']",
    "[role='menuitem']", "[role='menuitemcheckbox']", "[role='menuitemradio']",
    "[tabindex]:not([tabindex='-1'])"
  ].join(", ");

  const seen = new Set();
  const elements = document.querySelectorAll(selector);

  elements.forEach((el, index) => {
    if (seen.has(el)) return;
    seen.add(el);

    const type = getElementType(el);
    if (!type) return;
    if (!isUsable(el)) return;

    const identifier = getIdentifier(el, index);

    // Extra metadata
    const extra = {};
    if (el.tagName.toLowerCase() === "a") extra.href = el.href;
    if (el.tagName.toLowerCase() === "select") {
      extra.options = Array.from(el.options).map(o => o.text).slice(0, 10);
    }
    if (el.tagName.toLowerCase() === "input" && (el.type === "checkbox" || el.type === "radio")) {
      extra.checked = el.checked;
    }
    if (el.required) extra.required = true;
    if (el.readOnly) extra.readOnly = true;

    results.push({
      type,
      identifier,
      tagName: el.tagName.toLowerCase(),
      inputType: el.type || null,
      label: getLabel(el),
      ...extra,
    });
  });

  return results;
}

/**
 * Try to find the associated <label> text for a form element.
 */
function getLabel(el) {
  // Explicit label via for/id
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.innerText.trim();
  }
  // Wrapped in a label
  const parentLabel = el.closest("label");
  if (parentLabel) return parentLabel.innerText.trim();
  // aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.innerText.trim();
  }
  // aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();

  return null;
}

// Make scanInteractiveElements available to the popup via scripting.executeScript
window.__scanInteractiveElements = scanInteractiveElements;

// Auto-run and return result (used when injected via executeScript)
return scanInteractiveElements();
