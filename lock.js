"use strict";

/* =========================================================
   Kindermodus / PIN-Schutz für die Verwaltung.

   Betrifft ausschließlich das Dashboard (Tag-Liste, Bearbeiten,
   Erneut schreiben, Entfernen, Neuen Tag einrichten). Die
   Aktions-Ansicht beim tatsächlichen Scannen eines Tags
   (action.js) läuft komplett unabhängig davon und braucht nie
   einen PIN - Kinder scannen einen Tag, die hinterlegte Aktion
   passiert direkt, ohne die App selbst zu öffnen.

   Der PIN wird NICHT im Klartext gespeichert, sondern nur als
   SHA-256-Hash in localStorage. Das ist kein Schutz gegen
   technisch versierte Erwachsene (der Hash lässt sich mit
   genug Aufwand brute-forcen, und wer Zugriff auf das Handy
   hat, kann die App-Daten ohnehin löschen) - es reicht aber,
   um Kinder von den Verwaltungsfunktionen fernzuhalten.
   ========================================================= */

const PIN_HASH_KEY = "nfcPinHash";
const UNLOCK_SESSION_KEY = "nfcUnlockedUntil";
const AUTO_LOCK_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ["click", "touchstart", "keydown", "input"];

let autoLockTimer = null;
let setupStage = "enter"; // "enter" | "confirm"
let pendingPin = "";

function hasPinSet() {
  return !!localStorage.getItem(PIN_HASH_KEY);
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* Bleibt über Navigationen zwischen den Seiten der App hinweg gültig
   (z.B. Dashboard -> Setup -> zurück), aber nicht über einen Neustart
   der App hinaus - sessionStorage wird beim Schließen geleert. */
function isSessionUnlocked() {
  const until = Number(sessionStorage.getItem(UNLOCK_SESSION_KEY) || 0);
  return until > Date.now();
}

function extendSession() {
  sessionStorage.setItem(UNLOCK_SESSION_KEY, String(Date.now() + AUTO_LOCK_MS));
}

function clearSession() {
  sessionStorage.removeItem(UNLOCK_SESSION_KEY);
}

function showScreen(name) {
  document.getElementById("locked-screen").hidden = name !== "locked";
  document.getElementById("pin-screen").hidden = name !== "pin";
  document.getElementById("unlocked-dashboard").hidden = name !== "unlocked";
}

function initLockGate() {
  document.getElementById("unlock-btn").addEventListener("click", () => renderPinEntry());

  if (!hasPinSet()) {
    renderPinSetup();
    return;
  }
  if (isSessionUnlocked()) {
    unlockDashboard();
  } else {
    renderLockedScreen();
  }
}

/* ---------------- Gesperrter Zustand ---------------- */

function renderLockedScreen() {
  clearSession();
  clearAutoLockTimer();
  detachActivityListeners();
  showScreen("locked");
}

/* ---------------- PIN-Eingabe (Entsperren) ---------------- */

function renderPinEntry(errorText) {
  showScreen("pin");
  document.getElementById("pin-screen").innerHTML = pinScreenHtml({
    title: "Verwaltung entsperren",
    subtitle: "Bitte PIN eingeben",
    errorText,
    showCancel: true,
  });

  wirePinPad((pin) => {
    sha256Hex(pin).then((hash) => {
      if (hash === localStorage.getItem(PIN_HASH_KEY)) {
        unlockDashboard();
      } else {
        renderPinEntry("Falscher PIN. Bitte erneut versuchen.");
      }
    });
  });

  document.getElementById("pin-cancel-btn").addEventListener("click", renderLockedScreen);
}

/* ---------------- PIN-Einrichtung (erster Start) ---------------- */

function renderPinSetup() {
  setupStage = "enter";
  pendingPin = "";
  renderPinSetupStep();
}

function renderPinSetupStep(errorText) {
  showScreen("pin");
  const isConfirm = setupStage === "confirm";
  document.getElementById("pin-screen").innerHTML = pinScreenHtml({
    title: "PIN für die Verwaltung einrichten",
    subtitle: isConfirm ? "PIN zur Bestätigung erneut eingeben" : "Wähle einen 4-stelligen PIN für die Verwaltung",
    hint: "Bitte den PIN gut merken oder notieren.",
    errorText,
    showCancel: false,
  });

  wirePinPad((pin) => {
    if (setupStage === "enter") {
      pendingPin = pin;
      setupStage = "confirm";
      renderPinSetupStep();
      return;
    }
    if (pin !== pendingPin) {
      setupStage = "enter";
      pendingPin = "";
      renderPinSetupStep("Die PINs stimmten nicht überein. Bitte erneut von vorne.");
      return;
    }
    sha256Hex(pin).then((hash) => {
      localStorage.setItem(PIN_HASH_KEY, hash);
      unlockDashboard();
    });
  });
}

/* ---------------- Gemeinsame PIN-Pad-UI ---------------- */

function pinScreenHtml({ title, subtitle, hint, errorText, showCancel }) {
  return `
    <div class="pin-card surface-card">
      <h2>${escapeForDisplay(title)}</h2>
      <p>${escapeForDisplay(subtitle)}</p>
      ${errorText ? `<p class="pin-error">${escapeForDisplay(errorText)}</p>` : ""}
      <div class="pin-dots" id="pin-dots">
        <span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div class="pin-keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9]
          .map((n) => `<button type="button" class="pin-key" data-digit="${n}">${n}</button>`)
          .join("")}
        <span></span>
        <button type="button" class="pin-key" data-digit="0">0</button>
        <button type="button" class="pin-key pin-key-backspace" id="pin-backspace" aria-label="Löschen">
          <span class="icon">${ICONS.backspace}</span>
        </button>
      </div>
      ${hint ? `<p class="field-hint">${escapeForDisplay(hint)}</p>` : ""}
      ${showCancel ? '<button type="button" id="pin-cancel-btn" class="btn btn-secondary btn-block">Abbrechen</button>' : ""}
    </div>
  `;
}

function wirePinPad(onComplete) {
  let entered = "";
  const dots = document.querySelectorAll("#pin-dots .pin-dot");

  function updateDots() {
    dots.forEach((dot, i) => dot.classList.toggle("filled", i < entered.length));
  }

  document.querySelectorAll(".pin-key[data-digit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (entered.length >= 4) {
        return;
      }
      entered += btn.dataset.digit;
      updateDots();
      if (entered.length === 4) {
        onComplete(entered);
      }
    });
  });

  document.getElementById("pin-backspace").addEventListener("click", () => {
    entered = entered.slice(0, -1);
    updateDots();
  });
}

/* ---------------- Entsperrt: volles Dashboard + Auto-Relock ---------------- */

function unlockDashboard() {
  showScreen("unlocked");
  initDashboard();
  resetAutoLockTimer();
  attachActivityListeners();
}

function resetAutoLockTimer() {
  extendSession();
  clearAutoLockTimer();
  autoLockTimer = setTimeout(renderLockedScreen, AUTO_LOCK_MS);
}

function clearAutoLockTimer() {
  if (autoLockTimer) {
    clearTimeout(autoLockTimer);
    autoLockTimer = null;
  }
}

function attachActivityListeners() {
  ACTIVITY_EVENTS.forEach((evt) => document.addEventListener(evt, resetAutoLockTimer));
}

function detachActivityListeners() {
  ACTIVITY_EVENTS.forEach((evt) => document.removeEventListener(evt, resetAutoLockTimer));
}
