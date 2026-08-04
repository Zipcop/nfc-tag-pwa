"use strict";

/* Generische Modal-Infrastruktur für Dashboard-Dienstprogramme
   (Tag-Infos anzeigen). */

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
