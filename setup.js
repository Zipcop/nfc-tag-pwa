"use strict";

let mode = "create"; // "create" | "edit" | "rewrite"
let currentEditTag = null;
let scannedSerial = null;
let scannedRecords = [];
let activeScanController = null;

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
   Schritt 2a (create): Formular - erst Name/Label, dann Typ.
   ========================================================= */

function renderCreateForm() {
  document.getElementById("setup-flow").innerHTML = `
    ${existingContentBanner()}
    <form id="tag-form" class="surface-card" novalidate>
      <label for="field-label">Name / Label</label>
      <input type="text" id="field-label" placeholder="z.B. Waschmaschine oder Schlüssel von Lena" required>

      <fieldset>
        <label>Typ</label>
        <div class="type-choice">
          <label>
            <input type="radio" name="tagType" value="timer" checked>
            <span class="type-icon" data-icon="clock"></span>
            <span>Timer</span>
          </label>
          <label>
            <input type="radio" name="tagType" value="contact">
            <span class="type-icon" data-icon="contact"></span>
            <span>Kontakt</span>
          </label>
        </div>
      </fieldset>

      <fieldset id="timer-fields">
        <label for="field-minutes">Minuten</label>
        <input type="number" id="field-minutes" min="1" step="1" placeholder="z.B. 90" required>
      </fieldset>

      <fieldset id="contact-fields" hidden>
        <label for="field-tel">Telefonnummer</label>
        <input type="tel" id="field-tel" placeholder="z.B. +49 151 23456789">

        <label for="field-msg">Nachricht beim Scan</label>
        <textarea id="field-msg" placeholder="z.B. Bitte melde dich, wenn du diesen Schlüssel findest!"></textarea>

        <div class="switch-row">
          <label for="field-notify">Mich per Push benachrichtigen, wenn gescannt</label>
          <input type="checkbox" id="field-notify">
        </div>
        <p id="notify-hint" class="field-hint" hidden>
          Du wirst per ntfy.sh benachrichtigt. Installiere dafür kostenlos die ntfy-App und abonniere das Thema, das nach dem Schreiben angezeigt wird.
        </p>
      </fieldset>

      <button type="submit" id="submit-btn" class="btn btn-primary btn-block">Fertig – Tag beschreiben</button>
      <p class="field-hint">Dafür bitte den Tag gleich noch einmal ans Handy halten.</p>
      <div id="write-status"></div>
    </form>
  `;
  hydrateIcons(document.getElementById("setup-flow"));

  setupTypeToggle();
  document.getElementById("tag-form").addEventListener("submit", handleCreateSubmit);

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

  document.getElementById("timer-fields").hidden = type !== "timer";
  document.getElementById("contact-fields").hidden = type !== "contact";

  document.getElementById("field-minutes").required = type === "timer";
  document.getElementById("field-tel").required = type === "contact";
}

function collectCreateFormData() {
  const type = document.querySelector('input[name="tagType"]:checked').value;
  const label = document.getElementById("field-label").value.trim();
  const id = randomId(type);
  const createdAt = new Date().toISOString();

  if (type === "timer") {
    return {
      id,
      type,
      label,
      minutes: Number(document.getElementById("field-minutes").value),
      createdAt,
    };
  }

  const notify = document.getElementById("field-notify").checked;
  return {
    id,
    type,
    label,
    name: label,
    tel: document.getElementById("field-tel").value.trim(),
    msg: document.getElementById("field-msg").value.trim(),
    notify,
    topic: notify ? randomId("nfc") : null,
    createdAt,
  };
}

async function handleCreateSubmit(event) {
  event.preventDefault();

  const telField = document.getElementById("field-tel");
  if (telField.required && !isValidPhone(telField.value)) {
    telField.setCustomValidity("Bitte eine gültige Telefonnummer eingeben (z.B. +49 151 23456789).");
    telField.reportValidity();
    return;
  }
  telField.setCustomValidity("");

  const config = collectCreateFormData();
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
   Schritt 2b (rewrite): Konfiguration steht schon fest,
   nur noch bestätigen und schreiben.
   ========================================================= */

function renderRewriteConfirm() {
  const tag = currentEditTag;
  document.getElementById("setup-flow").innerHTML = `
    ${existingContentBanner()}
    <div class="sticker-card type-${tag.type} action-card">
      <span class="action-icon">${ICONS[tag.type === "timer" ? "clock" : "contact"]}</span>
      <h2>${escapeForDisplay(tag.label)}</h2>
      <p>${escapeForDisplay(tagMetaText(tag))}</p>
      <button type="button" id="write-btn" class="btn btn-primary btn-block">Fertig – Tag beschreiben</button>
      <p class="field-hint">Bitte den Tag noch einmal (oder weiterhin) ans Handy halten.</p>
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
  const tag = currentEditTag;
  document.getElementById("setup-flow").innerHTML = `
    <form id="tag-form" class="surface-card" novalidate>
      <label for="field-label">Name / Label</label>
      <input type="text" id="field-label" required>

      <fieldset>
        <label>Typ</label>
        <div class="type-choice">
          <label>
            <input type="radio" name="tagType" value="timer">
            <span class="type-icon" data-icon="clock"></span>
            <span>Timer</span>
          </label>
          <label>
            <input type="radio" name="tagType" value="contact">
            <span class="type-icon" data-icon="contact"></span>
            <span>Kontakt</span>
          </label>
        </div>
      </fieldset>

      <fieldset id="timer-fields">
        <label for="field-minutes">Minuten</label>
        <input type="number" id="field-minutes" min="1" step="1" required>
      </fieldset>

      <fieldset id="contact-fields" hidden>
        <label for="field-tel">Telefonnummer</label>
        <input type="tel" id="field-tel">

        <label for="field-msg">Nachricht beim Scan</label>
        <textarea id="field-msg"></textarea>

        <div class="switch-row">
          <label for="field-notify">Mich per Push benachrichtigen, wenn gescannt</label>
          <input type="checkbox" id="field-notify">
        </div>
        <p id="notify-hint" class="field-hint" hidden>
          Du wirst per ntfy.sh benachrichtigt. Installiere dafür kostenlos die ntfy-App und abonniere das Thema, das nach dem Speichern angezeigt wird.
        </p>
      </fieldset>

      <button type="submit" id="submit-btn" class="btn btn-primary btn-block">Speichern</button>
      <p class="field-hint">Die Änderungen werden nur gespeichert – der physische Tag wird dabei nicht angefasst. Nutze im Dashboard „Erneut auf Tag schreiben", um sie zu übertragen.</p>
    </form>
  `;
  hydrateIcons(document.getElementById("setup-flow"));

  fillFormFromTag(tag);
  setupTypeToggle();
  document.getElementById("tag-form").addEventListener("submit", handleEditSubmit);

  const notifyCheckbox = document.getElementById("field-notify");
  notifyCheckbox.addEventListener("change", () => {
    document.getElementById("notify-hint").hidden = !notifyCheckbox.checked;
  });
}

function fillFormFromTag(tag) {
  document.getElementById("field-label").value = tag.label;
  const radio = document.querySelector(`input[name="tagType"][value="${tag.type}"]`);
  if (radio) {
    radio.checked = true;
  }
  if (tag.type === "timer") {
    document.getElementById("field-minutes").value = tag.minutes;
  } else {
    document.getElementById("field-tel").value = tag.tel;
    document.getElementById("field-msg").value = tag.msg || "";
    document.getElementById("field-notify").checked = !!tag.notify;
    document.getElementById("notify-hint").hidden = !tag.notify;
  }
  updateTypeFields();
}

function handleEditSubmit(event) {
  event.preventDefault();

  const telField = document.getElementById("field-tel");
  if (telField.required && !isValidPhone(telField.value)) {
    telField.setCustomValidity("Bitte eine gültige Telefonnummer eingeben (z.B. +49 151 23456789).");
    telField.reportValidity();
    return;
  }
  telField.setCustomValidity("");

  const type = document.querySelector('input[name="tagType"]:checked').value;
  const label = document.getElementById("field-label").value.trim();
  const updated = { id: currentEditTag.id, type, label, createdAt: currentEditTag.createdAt };

  if (type === "timer") {
    updated.minutes = Number(document.getElementById("field-minutes").value);
  } else {
    const notify = document.getElementById("field-notify").checked;
    updated.name = label;
    updated.tel = document.getElementById("field-tel").value.trim();
    updated.msg = document.getElementById("field-msg").value.trim();
    updated.notify = notify;
    updated.topic = notify ? currentEditTag.topic || randomId("nfc") : null;
  }

  saveTag(updated);
  window.location.href = "index.html";
}

/* =========================================================
   Gemeinsames
   ========================================================= */

function isValidPhone(value) {
  return /^\+?[0-9\s\-/]{6,20}$/.test(value.trim());
}
