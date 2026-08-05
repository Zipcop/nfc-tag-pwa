"use strict";

/* Generische Modal-Infrastruktur für Dashboard-Dienstprogramme
   (Tag-Infos anzeigen, Design-Einstellungen). */

let activeScanController = null;

function openModal(html) {
  const overlay = document.getElementById("modal-overlay");
  const content = document.getElementById("modal-content");
  content.innerHTML = html;
  hydrateIcons(content);
  overlay.hidden = false;
}

function closeModal() {
  if (activeScanController) {
    activeScanController.abort();
    activeScanController = null;
  }
  // Harmlos, auch wenn dieses Modal (z.B. Design-Einstellungen) nie
  // suppressTagDispatch() aufgerufen hat - resume() setzt dann nur ein
  // bereits falsches Flag erneut auf false.
  if (isNativePlatform()) {
    resumeTagDispatch();
  }
  document.getElementById("modal-overlay").hidden = true;
}

function recordsListHtml(records) {
  if (records.length === 0) {
    return "<p>Der Tag ist leer.</p>";
  }
  const items = records
    .map((r) => {
      const f = formatNdefRecord(r);
      return `<li><strong>${escapeForDisplay(f.type)}:</strong> ${escapeForDisplay(f.content)}</li>`;
    })
    .join("");
  return `<ul class="tag-content-list">${items}</ul>`;
}

/* ---------------- Tag-Infos anzeigen ---------------- */

function openTagInfoModal() {
  if (!isWebNfcSupported()) {
    openModal(`
      <div class="banner banner-warning">
        <span class="icon" data-icon="warning"></span>
        <span>Diese Funktion benötigt Chrome auf einem Android-Handy mit NFC.</span>
      </div>
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Schließen</button>
    `);
    return;
  }

  openModal(`
    <h2>Tag-Infos</h2>
    <p id="scan-status">Bitte Tag jetzt ans Handy halten…</p>
    <button type="button" class="btn btn-secondary btn-block" onclick="closeModal()">Abbrechen</button>
  `);

  // Solange dieses Modal offen ist, soll ein Tag-Scan nur hier ausgewertet
  // werden - nicht zusätzlich Androids normaler NFC-Intent-Dispatch die
  // hinterlegte Aktion im Hintergrund öffnen (siehe TagDispatchControlPlugin).
  if (isNativePlatform()) {
    suppressTagDispatch();
  }

  activeScanController = new AbortController();
  scanNfcTagOnce(activeScanController.signal)
    .then((event) => {
      activeScanController = null;
      const records = event.message ? Array.from(event.message.records) : [];
      const size = estimateNdefMessageSize(records);
      const serial = event.serialNumber || "unbekannt";

      openModal(`
        <h2>Tag-Infos</h2>
        <p><strong>Seriennummer:</strong> ${escapeForDisplay(serial)}</p>
        <p><strong>Gespeicherte Datensätze:</strong></p>
        ${recordsListHtml(records)}
        <p><strong>Ungefähre Größe:</strong> ca. ${size} Byte</p>
        <p class="field-hint">Web NFC zeigt nur Seriennummer und gespeicherten Inhalt - nicht den genauen Chip-Typ (z.B. NTAG213/215/216) oder die tatsächliche Speicherkapazität.</p>
        <div class="btn-row">
          <button type="button" class="btn btn-secondary" onclick="openTagInfoModal()">Erneut scannen</button>
          <button type="button" class="btn btn-primary" onclick="closeModal()">Schließen</button>
        </div>
      `);
    })
    .catch((err) => {
      activeScanController = null;
      if (err.name === "AbortError") {
        return;
      }
      openModal(`
        <h2>Tag-Infos</h2>
        <div class="banner banner-error">
          <span class="icon" data-icon="close"></span>
          <span>Lesen fehlgeschlagen: ${escapeForDisplay(err.message || String(err))}</span>
        </div>
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Schließen</button>
      `);
    });
}

/* ---------------- Design-Einstellungen ----------------
   Wirkt über die globalen CSS-Variablen (siehe theme-generator.js/
   style.css) auf die gesamte App - Dashboard, Setup, Aktions-Ansicht
   und Kindermodus-Sperrbildschirm brauchen dafür keinen eigenen Code,
   sie nutzen alle bereits dieselben CSS-Variablen. */

function themeTileHtml(mode, label, vars, isActive) {
  return `
    <button type="button" class="theme-tile${isActive ? " theme-tile-active" : ""}" data-theme-mode="${mode}"
      style="--tile-bg:${vars.bg}; --tile-accent:${vars.amber}; --tile-ink:${pickReadableText(vars.bg)};">
      <span class="theme-tile-swatch">
        <span class="theme-tile-dot" style="background:${vars.amber}"></span>
        <span class="theme-tile-dot" style="background:${vars.teal}"></span>
      </span>
      <span class="theme-tile-label">${escapeForDisplay(label)}</span>
    </button>
  `;
}

function openThemeSettingsModal() {
  renderThemeModal();
}

function renderThemeModal() {
  const currentMode = localStorage.getItem(THEME_MODE_KEY) || "werkstatt";
  const currentFontScale = localStorage.getItem(FONT_SCALE_KEY) || "klein";
  const customHex = localStorage.getItem(CUSTOM_PRIMARY_HEX_KEY) || THEME_PRESETS.werkstatt.amber;

  const presetTiles = THEME_TILES.map((t) => themeTileHtml(t.mode, t.label, THEME_PRESETS[t.mode], currentMode === t.mode)).join("");
  const customTile = themeTileHtml("custom", "Eigene Farbe", buildThemeFromColor(customHex), currentMode === "custom");

  const fontLabels = { klein: "Klein", normal: "Normal", gross: "Groß" };

  openModal(`
    <h2>Design</h2>
    <p class="field-hint">Wirkt auf die gesamte App - Dashboard, Setup, Aktions-Ansicht und Sperrbildschirm.</p>
    <div class="theme-tiles">${presetTiles}${customTile}</div>

    <div id="custom-color-panel" ${currentMode === "custom" ? "" : "hidden"}>
      <label for="custom-color-input">Eigene Hauptfarbe</label>
      <input type="color" id="custom-color-input" value="${customHex}">
      <div class="theme-preview-card sticker-card type-timer" id="custom-theme-preview">
        <span class="action-icon">${ICONS.clock}</span>
        <p class="tag-label">Beispiel-Tag</p>
        <button type="button" class="btn btn-primary" id="custom-theme-preview-btn">Aktion ausführen</button>
      </div>
      <button type="button" id="apply-custom-theme-btn" class="btn btn-primary btn-block">Übernehmen</button>
    </div>

    <h2>Schriftgröße</h2>
    <div class="font-scale-row">
      ${Object.keys(fontLabels)
        .map(
          (key) =>
            `<button type="button" class="btn font-scale-btn${currentFontScale === key ? " font-scale-active" : ""}" data-font-scale="${key}">${fontLabels[key]}</button>`
        )
        .join("")}
    </div>

    <button type="button" class="btn btn-secondary btn-block" onclick="closeModal()">Schließen</button>
  `);

  wireThemeModal();
}

function wireThemeModal() {
  document.querySelectorAll(".theme-tile[data-theme-mode]").forEach((tile) => {
    tile.addEventListener("click", () => {
      const mode = tile.dataset.themeMode;
      if (mode === "custom") {
        // Nur das Panel öffnen, noch nichts anwenden/speichern - das
        // passiert erst über den "Übernehmen"-Button weiter unten.
        document.querySelectorAll(".theme-tile").forEach((t) => t.classList.toggle("theme-tile-active", t === tile));
        document.getElementById("custom-color-panel").hidden = false;
        return;
      }
      setThemeMode(mode);
      renderThemeModal();
    });
  });

  const colorInput = document.getElementById("custom-color-input");
  if (colorInput) {
    colorInput.addEventListener("input", () => updateCustomThemePreview(colorInput.value));
    document.getElementById("apply-custom-theme-btn").addEventListener("click", () => {
      setThemeMode("custom", colorInput.value);
      renderThemeModal();
    });
  }

  document.querySelectorAll(".font-scale-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setFontScale(btn.dataset.fontScale);
      renderThemeModal();
    });
  });
}

function updateCustomThemePreview(hex) {
  const vars = buildThemeFromColor(hex);
  const preview = document.getElementById("custom-theme-preview");
  if (!preview) {
    return;
  }
  preview.style.setProperty("--card", vars.card);
  preview.style.setProperty("--ink", vars.ink);
  preview.style.setProperty("--amber", vars.amber);
  preview.style.setProperty("--amber-bg", vars.amberBg);
  const btn = document.getElementById("custom-theme-preview-btn");
  if (btn) {
    btn.style.background = vars.amber;
    btn.style.color = vars.buttonText;
  }
}
