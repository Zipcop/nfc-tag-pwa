"use strict";

let mode = "create"; // "create" | "edit" | "rewrite"
let currentEditTag = null;
let scannedSerial = null;
let scannedRecords = [];
let activeScanController = null;

const TAG_TYPES = [
  { value: "timer", icon: "clock", label: "Timer" },
  { value: "contact", icon: "contact", label: "Kontakt" },
  { value: "checkin", icon: "check", label: "Check-in" },
  { value: "route", icon: "route", label: "Route" },
  { value: "link", icon: "link", label: "Link" },
  { value: "checklist", icon: "checklist", label: "Checkliste" },
];

function initSetup() {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("edit");
  const isRewrite = params.get("rewrite") === "1";

  if (editId) {
    currentEditTag = getTag(editId);
    if (!currentEditTag) {
      window.location.href = "index.html";
      return;
    }
    mode = isRewrite ? "rewrite" : "edit";
  } else {
    mode = "create";
  }

  // "create"/"rewrite" fassen den physischen Tag an (Scan und/oder Schreiben) -
  // solange dieser Screen offen ist, soll ein Tag-Kontakt ausschließlich vom
  // gezielten Scan/Schreib-Vorgang hier ausgewertet werden, nicht zusätzlich
  // von Androids normalem NFC-Intent-Dispatch (siehe native.js). "edit" fasst
  // den Tag nie an und braucht das nicht. resumeTagDispatch() läuft über
  // pagehide statt an einzelnen Buttons, damit jeder Weg von diesem Screen
  // weg (Zurück-Link, Abbrechen, erfolgreicher Abschluss) abgedeckt ist.
  if (mode !== "edit" && isNativePlatform()) {
    suppressTagDispatch();
    window.addEventListener("pagehide", () => resumeTagDispatch(), { once: true });
  }

  if (mode === "edit") {
    document.getElementById("page-title").textContent = "Tag bearbeiten";
    renderEditForm();
    return;
  }

  document.getElementById("page-title").textContent =
    mode === "rewrite" ? "Erneut auf Tag schreiben" : "Neuen Tag einrichten";

  if (!isWebNfcSupported()) {
    renderUnsupportedStep();
    return;
  }

  startScanStep();
}

function renderUnsupportedStep() {
  document.getElementById("setup-flow").innerHTML = `
    <div class="banner banner-warning">
      <span class="icon" data-icon="warning"></span>
      <span>Diese Funktion benötigt Chrome auf einem Android-Handy mit NFC.</span>
    </div>
  `;
  hydrateIcons(document.getElementById("setup-flow"));
}

/* =========================================================
   Schritt 1 (create/rewrite): Tag zuerst kurz auslesen -
   Seriennummer merken, vorhandenen Inhalt ggf. anzeigen.
   ========================================================= */

function startScanStep() {
  document.getElementById("setup-flow").innerHTML = `
    <div class="sticker-card action-card">
      <span class="action-icon" data-icon="ripple"></span>
      <h2>Tag jetzt ans Handy halten</h2>
      <p>Der Tag wird kurz geprüft, bevor es weitergeht. Danach folgt ein zweiter kurzer Kontakt zum Speichern.</p>
      <button type="button" id="cancel-scan-btn" class="btn btn-secondary btn-block">Abbrechen</button>
    </div>
  `;
  hydrateIcons(document.getElementById("setup-flow"));

  document.getElementById("cancel-scan-btn").addEventListener("click", () => {
    if (activeScanController) {
      activeScanController.abort();
    }
    window.location.href = "index.html";
  });

  activeScanController = new AbortController();
  scanNfcTagOnce(activeScanController.signal)
    .then((event) => {
      activeScanController = null;
      scannedSerial = event.serialNumber || null;
      scannedRecords = event.message ? Array.from(event.message.records) : [];
      if (mode === "create") {
        renderCreateForm();
      } else {
        renderRewriteConfirm();
      }
    })
    .catch((err) => {
      activeScanController = null;
      if (err.name === "AbortError") {
        return;
      }
      renderScanError(err);
    });
}

function renderScanError(err) {
  document.getElementById("setup-flow").innerHTML = `
    <div class="banner banner-error">
      <span class="icon">${ICONS.close}</span>
      <span>Tag konnte nicht gelesen werden: ${escapeForDisplay(err.message || String(err))}</span>
    </div>
    <button type="button" id="retry-scan-btn" class="btn btn-primary btn-block">Erneut versuchen</button>
  `;
  document.getElementById("retry-scan-btn").addEventListener("click", startScanStep);
}

function existingContentBanner() {
  if (scannedRecords.length === 0) {
    return "";
  }
  const items = scannedRecords
    .map((r) => {
      const f = formatNdefRecord(r);
      return `<li><strong>${escapeForDisplay(f.type)}:</strong> ${escapeForDisplay(f.content)}</li>`;
    })
    .join("");
  return `
    <div class="banner banner-warning">
      <span class="icon">${ICONS.warning}</span>
      <div>
        Dieser Tag enthält bereits Daten (Seriennummer ${escapeForDisplay(scannedSerial || "unbekannt")}):
        <ul class="tag-content-list">${items}</ul>
        Wird beim Speichern überschrieben.
      </div>
    </div>
  `;
}

/* =========================================================
   Gemeinsames Formular für "Neuen Tag einrichten" und "Bearbeiten" -
   erst Name/Label, dann Typ, dann die typ-spezifischen Felder.
   ========================================================= */

function typeChoiceHtml(defaultValue) {
  return TAG_TYPES.map(
    (t) => `
      <label>
        <input type="radio" name="tagType" value="${t.value}" ${t.value === defaultValue ? "checked" : ""}>
        <span class="type-icon" data-icon="${t.icon}"></span>
        <span>${t.label}</span>
      </label>
    `
  ).join("");
}

function typeFieldsHtml() {
  return `
    <fieldset id="timer-fields">
      <label for="field-minutes">Minuten</label>
      <input type="number" id="field-minutes" min="1" step="1" placeholder="z.B. 90">
    </fieldset>

    <fieldset id="contact-fields" hidden>
      <label for="field-tel">Telefonnummer</label>
      <input type="tel" id="field-tel" placeholder="z.B. +49 151 23456789" pattern="^\\+?[0-9\\s\\-/]{6,20}$">

      <label for="field-msg">Nachricht beim Scan</label>
      <textarea id="field-msg" placeholder="z.B. Bitte melde dich, wenn du diesen Schlüssel findest!"></textarea>

      <div class="switch-row">
        <label for="field-notify">Mich per Push benachrichtigen, wenn gescannt</label>
        <input type="checkbox" id="field-notify">
      </div>
      <p id="notify-hint" class="field-hint" hidden>
        Du bekommst dafür eine Browser-Benachrichtigung auf diesem Handy. Falls noch nicht geschehen, dafür im Dashboard „Benachrichtigungen aktivieren" antippen.
      </p>
    </fieldset>

    <fieldset id="checkin-fields" hidden>
      <label for="field-checkin-msg">Nachricht beim Scan</label>
      <textarea id="field-checkin-msg" placeholder="z.B. ist zuhause angekommen"></textarea>
      <p class="field-hint">Beim Scannen wird automatisch eine Browser-Benachrichtigung verschickt. Falls noch nicht geschehen, dafür im Dashboard „Benachrichtigungen aktivieren" antippen.</p>
    </fieldset>

    <fieldset id="route-fields" hidden>
      <label for="field-dest">Zieladresse</label>
      <input type="text" id="field-dest" placeholder="z.B. Musterstraße 1, 12345 Musterstadt">
    </fieldset>

    <fieldset id="link-fields" hidden>
      <label for="field-link-url">Ziel-URL</label>
      <input type="url" id="field-link-url" placeholder="https://…" pattern="https://.*">
      <p class="field-hint">Muss mit https:// beginnen.</p>
    </fieldset>

    <fieldset id="checklist-fields" hidden>
      <label>Punkte</label>
      <div id="checklist-items-editor"></div>
      <button type="button" id="add-checklist-item-btn" class="btn btn-secondary">+ Punkt hinzufügen</button>
    </fieldset>
  `;
}

function renderTagForm({ prefillTag, submitLabel, hintText, onSubmit, showWriteExtras }) {
  document.getElementById("setup-flow").innerHTML = `
    ${showWriteExtras ? existingContentBanner() : ""}
    <form id="tag-form" class="surface-card" novalidate>
      <label for="field-label">Name / Label</label>
      <input type="text" id="field-label" placeholder="z.B. Waschmaschine oder Schlüssel von Lena" required>

      <fieldset>
        <label>Typ</label>
        <div class="type-choice">${typeChoiceHtml(prefillTag ? prefillTag.type : "timer")}</div>
      </fieldset>

      ${typeFieldsHtml()}

      <button type="submit" id="submit-btn" class="btn btn-primary btn-block">${submitLabel}</button>
      <p class="field-hint">${hintText}</p>
      ${showWriteExtras ? '<p id="size-preview" class="size-preview"></p><div id="write-status"></div>' : ""}
    </form>
  `;
  hydrateIcons(document.getElementById("setup-flow"));

  setupTypeToggle();
  setupChecklistEditor(prefillTag && prefillTag.type === "checklist" ? prefillTag.items : [""]);

  if (prefillTag) {
    fillFormFromTag(prefillTag);
  }

  document.getElementById("tag-form").addEventListener("submit", onSubmit);

  if (showWriteExtras) {
    document.getElementById("tag-form").addEventListener("input", updateSizePreview);
    updateSizePreview();
  }

  const notifyCheckbox = document.getElementById("field-notify");
  notifyCheckbox.addEventListener("change", () => {
    document.getElementById("notify-hint").hidden = !notifyCheckbox.checked;
  });
}

function setupTypeToggle() {
  const radios = document.querySelectorAll('input[name="tagType"]');
  radios.forEach((radio) => {
    radio.addEventListener("change", updateTypeFields);
  });
  updateTypeFields();
}

function updateTypeFields() {
  const selected = document.querySelector('input[name="tagType"]:checked');
  const type = selected ? selected.value : null;

  TAG_TYPES.forEach((t) => {
    document.getElementById(`${t.value}-fields`).hidden = t.value !== type;
  });

  document.getElementById("field-minutes").required = type === "timer";
  document.getElementById("field-dest").required = type === "route";
  document.getElementById("field-link-url").required = type === "link";
}

/* ---------------- Checkliste: dynamische Punkte-Liste ---------------- */

function setupChecklistEditor(initialItems) {
  const editor = document.getElementById("checklist-items-editor");
  editor.innerHTML = "";
  (initialItems && initialItems.length ? initialItems : [""]).forEach(addChecklistItemRow);

  document.getElementById("add-checklist-item-btn").addEventListener("click", () => {
    addChecklistItemRow("");
    updateSizePreview();
  });
}

function addChecklistItemRow(value) {
  const editor = document.getElementById("checklist-items-editor");
  const row = document.createElement("div");
  row.className = "checklist-editor-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "checklist-item-input";
  input.placeholder = "z.B. Herd aus?";
  input.value = value || "";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "checklist-item-remove";
  removeBtn.setAttribute("aria-label", "Punkt entfernen");
  removeBtn.innerHTML = `<span class="icon">${ICONS.close}</span>`;
  removeBtn.addEventListener("click", () => {
    if (document.querySelectorAll(".checklist-item-input").length > 1) {
      row.remove();
      updateSizePreview();
    }
  });

  row.append(input, removeBtn);
  editor.appendChild(row);
}

/* ---------------- Geschätzte Tag-Größe ---------------- */

function updateSizePreview() {
  const preview = document.getElementById("size-preview");
  if (!preview) {
    return;
  }
  const config = collectFormData(null);
  const url = buildTagUrl(config);
  const size = estimateTagUrlSize(url);
  const isWarning = size > 130;

  preview.classList.toggle("size-warning", isWarning);
  preview.textContent = isWarning
    ? `Geschätzte Größe: ca. ${size} Byte – das könnte für günstige Tags zu groß sein.`
    : `Geschätzte Größe: ca. ${size} Byte`;
}

/* ---------------- Formulardaten einsammeln ---------------- */

function collectFormData(existingTag) {
  const type = document.querySelector('input[name="tagType"]:checked').value;
  const label = document.getElementById("field-label").value.trim();
  const id = existingTag ? existingTag.id : randomId(type);
  const createdAt = existingTag ? existingTag.createdAt : new Date().toISOString();
  const base = { id, type, label, createdAt };

  if (type === "timer") {
    return { ...base, minutes: Number(document.getElementById("field-minutes").value) || 0 };
  }

  if (type === "contact") {
    return {
      ...base,
      name: label,
      tel: document.getElementById("field-tel").value.trim(),
      msg: document.getElementById("field-msg").value.trim(),
      notify: document.getElementById("field-notify").checked,
    };
  }

  if (type === "checkin") {
    return {
      ...base,
      name: label,
      msg: document.getElementById("field-checkin-msg").value.trim(),
    };
  }

  if (type === "route") {
    return { ...base, dest: document.getElementById("field-dest").value.trim() };
  }

  if (type === "link") {
    return { ...base, url: document.getElementById("field-link-url").value.trim() };
  }

  // checklist
  const items = Array.from(document.querySelectorAll(".checklist-item-input"))
    .map((input) => input.value.trim())
    .filter((v) => v.length > 0);
  return { ...base, items };
}

function validateForm() {
  const form = document.getElementById("tag-form");
  if (!form.reportValidity()) {
    return false;
  }
  const type = document.querySelector('input[name="tagType"]:checked').value;
  if (type === "checklist") {
    const hasItem = Array.from(document.querySelectorAll(".checklist-item-input")).some(
      (input) => input.value.trim().length > 0
    );
    if (!hasItem) {
      alert("Bitte mindestens einen Punkt eingeben.");
      return false;
    }
  }
  return true;
}

/* =========================================================
   Neuen Tag einrichten: Formular -> Fertig, Tag beschreiben.
   ========================================================= */

function renderCreateForm() {
  renderTagForm({
    prefillTag: null,
    submitLabel: "Fertig – Tag beschreiben",
    hintText: "Dafür bitte den Tag gleich noch einmal ans Handy halten.",
    onSubmit: handleCreateSubmit,
    showWriteExtras: true,
  });
}

async function handleCreateSubmit(event) {
  event.preventDefault();
  if (!validateForm()) {
    return;
  }

  const config = collectFormData(null);
  const url = buildTagUrl(config);
  const statusEl = document.getElementById("write-status");
  const submitBtn = document.getElementById("submit-btn");

  submitBtn.disabled = true;
  statusEl.className = "";
  statusEl.textContent = "Bitte Tag noch einmal ans Handy halten…";

  try {
    await writeNfcTag(url);
    saveTag(config);
    statusEl.className = "banner banner-success";
    statusEl.innerHTML = `<span class="icon">${ICONS.check}</span><span>Tag erfolgreich eingerichtet!</span>`;
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1200);
  } catch (err) {
    statusEl.className = "banner banner-error";
    statusEl.innerHTML = `<span class="icon">${ICONS.close}</span><span>Schreiben fehlgeschlagen: ${escapeForDisplay(err.message || String(err))}. Bitte erneut versuchen.</span>`;
  } finally {
    submitBtn.disabled = false;
  }
}

/* =========================================================
   Erneut auf Tag schreiben: Konfiguration steht schon fest,
   nur noch bestätigen und schreiben.
   ========================================================= */

function renderRewriteConfirm() {
  const tag = currentEditTag;
  const url = buildTagUrl(tag);
  const size = estimateTagUrlSize(url);
  const isWarning = size > 130;
  const meta = TYPE_META[tag.type] || { icon: "contact" };

  document.getElementById("setup-flow").innerHTML = `
    ${existingContentBanner()}
    <div class="sticker-card type-${tag.type} action-card">
      <span class="action-icon">${ICONS[meta.icon] || ""}</span>
      <h2>${escapeForDisplay(tag.label)}</h2>
      <p>${escapeForDisplay(tagMetaText(tag))}</p>
      <button type="button" id="write-btn" class="btn btn-primary btn-block">Fertig – Tag beschreiben</button>
      <p class="field-hint">Bitte den Tag noch einmal (oder weiterhin) ans Handy halten.</p>
      <p class="size-preview${isWarning ? " size-warning" : ""}">${
        isWarning
          ? `Geschätzte Größe: ca. ${size} Byte – das könnte für günstige Tags zu groß sein.`
          : `Geschätzte Größe: ca. ${size} Byte`
      }</p>
      <div id="write-status"></div>
    </div>
  `;
  document.getElementById("write-btn").addEventListener("click", () => performRewriteWrite(tag));
}

async function performRewriteWrite(tag) {
  const url = buildTagUrl(tag);
  const statusEl = document.getElementById("write-status");
  const btn = document.getElementById("write-btn");

  btn.disabled = true;
  statusEl.className = "";
  statusEl.textContent = "Bitte Tag jetzt ans Handy halten…";

  try {
    await writeNfcTag(url);
    statusEl.className = "banner banner-success";
    statusEl.innerHTML = `<span class="icon">${ICONS.check}</span><span>Tag erfolgreich beschrieben!</span>`;
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1200);
  } catch (err) {
    statusEl.className = "banner banner-error";
    statusEl.innerHTML = `<span class="icon">${ICONS.close}</span><span>Schreiben fehlgeschlagen: ${escapeForDisplay(err.message || String(err))}. Bitte erneut versuchen.</span>`;
  } finally {
    btn.disabled = false;
  }
}

/* =========================================================
   Bearbeiten: reine Konfigurationsänderung, ohne den
   physischen Tag anzufassen (kein Scan, kein Schreiben).
   ========================================================= */

function renderEditForm() {
  renderTagForm({
    prefillTag: currentEditTag,
    submitLabel: "Speichern",
    hintText:
      'Die Änderungen werden nur gespeichert – der physische Tag wird dabei nicht angefasst. Nutze im Dashboard „Erneut auf Tag schreiben", um sie zu übertragen.',
    onSubmit: handleEditSubmit,
    showWriteExtras: false,
  });
}

function fillFormFromTag(tag) {
  document.getElementById("field-label").value = tag.label;

  if (tag.type === "timer") {
    document.getElementById("field-minutes").value = tag.minutes;
  } else if (tag.type === "contact") {
    document.getElementById("field-tel").value = tag.tel;
    document.getElementById("field-msg").value = tag.msg || "";
    document.getElementById("field-notify").checked = !!tag.notify;
    document.getElementById("notify-hint").hidden = !tag.notify;
  } else if (tag.type === "checkin") {
    document.getElementById("field-checkin-msg").value = tag.msg || "";
  } else if (tag.type === "route") {
    document.getElementById("field-dest").value = tag.dest;
  } else if (tag.type === "link") {
    document.getElementById("field-link-url").value = tag.url;
  }
  // Checkliste: Punkte werden bereits über setupChecklistEditor() befüllt.

  updateTypeFields();
}

function handleEditSubmit(event) {
  event.preventDefault();
  if (!validateForm()) {
    return;
  }

  const updated = collectFormData(currentEditTag);
  saveTag(updated);
  window.location.href = "index.html";
}
