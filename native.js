"use strict";

/* =========================================================
   Phase-2-spezifische native Funktionen (Capacitor). Läuft nur
   innerhalb der nativen Android-App - auf der Phase-1-PWA
   (GitHub Pages) ist window.Capacitor nie vorhanden, isNativePlatform()
   liefert dort immer false und der komplette Rest dieser Datei bleibt
   ungenutzt. app.js/action.js/push.js rufen isNativePlatform() ab, um
   zwischen Web- und nativem Pfad zu verzweigen.
   ========================================================= */

function isNativePlatform() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function nativePlugins() {
  return window.Capacitor.Plugins;
}

/* ---------------- Laufende Timer (LocalNotifications) ---------------- */

const RUNNING_TIMERS_KEY = "nfcRunningTimers";

function getRunningTimers() {
  let list;
  try {
    const raw = localStorage.getItem(RUNNING_TIMERS_KEY);
    list = raw ? JSON.parse(raw) : [];
  } catch {
    list = [];
  }
  const now = Date.now();
  const active = list.filter((t) => t.fireAt > now);
  if (active.length !== list.length) {
    localStorage.setItem(RUNNING_TIMERS_KEY, JSON.stringify(active));
  }
  return active;
}

function addRunningTimer(timer) {
  const list = getRunningTimers();
  list.push(timer);
  localStorage.setItem(RUNNING_TIMERS_KEY, JSON.stringify(list));
}

function removeRunningTimer(id) {
  const list = getRunningTimers().filter((t) => t.id !== id);
  localStorage.setItem(RUNNING_TIMERS_KEY, JSON.stringify(list));
}

/* Stellt einen zuverlässigen nativen Alarm (läuft auch bei geschlossener
   App weiter) und merkt ihn in localStorage vor, damit er im Dashboard
   unter "Laufende Timer" auftaucht und abbrechbar ist. */
async function startNativeTimer(seconds, label) {
  const { LocalNotifications } = nativePlugins();
  const id = Math.floor(Math.random() * 2147483647);
  const fireAt = Date.now() + seconds * 1000;

  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") {
    const req = await LocalNotifications.requestPermissions();
    if (req.display !== "granted") {
      throw new Error("Berechtigung für Benachrichtigungen wurde nicht erteilt.");
    }
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: "Timer abgelaufen",
        body: label,
        schedule: { at: new Date(fireAt), allowWhileIdle: true },
      },
    ],
  });

  addRunningTimer({ id, label, fireAt });
  return { id, fireAt };
}

async function cancelNativeTimer(id) {
  const { LocalNotifications } = nativePlugins();
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (err) {
    console.warn("Timer konnte nicht abgebrochen werden:", err);
  }
  removeRunningTimer(id);
}

function formatRemainingTime(fireAt) {
  const ms = fireAt - Date.now();
  if (ms <= 0) {
    return "00:00";
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/* Rendert den "Laufende Timer"-Bereich im Dashboard - nur sichtbar, wenn
   mindestens ein Timer aktiv ist. Nur relevant nativ, auf der PWA ist
   getRunningTimers() immer leer, da startNativeTimer() dort nie läuft. */
let runningTimersInterval = null;

function renderRunningTimers() {
  const container = document.getElementById("running-timers");
  if (!container) {
    return;
  }
  const timers = getRunningTimers();

  if (timers.length === 0) {
    container.hidden = true;
    container.innerHTML = "";
    clearInterval(runningTimersInterval);
    runningTimersInterval = null;
    return;
  }

  container.hidden = false;
  container.innerHTML = `
    <h2>Laufende Timer</h2>
    <div class="tag-list">
      ${timers
        .map(
          (t) => `
        <div class="sticker-card type-timer">
          <div class="tag-card-head">
            <span class="tag-icon">${ICONS.clock}</span>
            <div class="tag-title-block">
              <span class="tag-label">${escapeForDisplay(t.label)}</span>
              <span class="tag-meta" data-fire-at="${t.fireAt}">${formatRemainingTime(t.fireAt)}</span>
            </div>
            <button type="button" class="btn btn-accent" data-cancel-timer-id="${t.id}">Abbrechen</button>
          </div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  container.querySelectorAll("[data-cancel-timer-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      await cancelNativeTimer(Number(btn.dataset.cancelTimerId));
      renderRunningTimers();
    });
  });

  if (!runningTimersInterval) {
    runningTimersInterval = setInterval(() => {
      const stillRunning = getRunningTimers();
      if (stillRunning.length === 0) {
        renderRunningTimers();
        return;
      }
      container.querySelectorAll("[data-fire-at]").forEach((el) => {
        el.textContent = formatRemainingTime(Number(el.dataset.fireAt));
      });
    }, 1000);
  }
}

/* ---------------- Push-Registrierung (FCM) ---------------- */

async function registerNativePush() {
  const { PushNotifications } = nativePlugins();

  const perm = await PushNotifications.checkPermissions();
  let status = perm.receive;
  if (status !== "granted") {
    const req = await PushNotifications.requestPermissions();
    status = req.receive;
  }
  if (status !== "granted") {
    throw new Error("Berechtigung für Push-Benachrichtigungen wurde nicht erteilt.");
  }

  return new Promise((resolve, reject) => {
    PushNotifications.addListener("registration", async (token) => {
      try {
        await fetch(`${PUSH_WORKER_URL}/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": PUSH_API_KEY },
          body: JSON.stringify({ fcmToken: token.value }),
        });
        resolve(token.value);
      } catch (err) {
        reject(err);
      }
    });
    PushNotifications.addListener("registrationError", (err) => {
      reject(new Error(err.error || "FCM-Registrierung fehlgeschlagen."));
    });
    PushNotifications.register();
  });
}

/* ---------------- Natives NFC (@capgo/capacitor-nfc) ----------------
   Liefert/erwartet dieselben Formen wie das Web-NFC-Pendant in app.js
   (scanNfcTagOnce/writeNfcTag/isWebNfcSupported), damit setup.js und
   nfc-tools.js unverändert bleiben - app.js verzweigt dort intern
   anhand von isNativePlatform() zwischen Web- und diesen Funktionen. */

/* NDEF-URI-Record von Hand bauen (TNF_WELL_KNOWN, Typ "U") - das Plugin
   arbeitet auf Roh-Byte-Ebene, anders als Web NFCs bequemer
   recordType:"url"-Kurzschreibweise. */
function buildNdefUriRecord(url) {
  let prefixCode = 0;
  let rest = url;
  if (url.startsWith("https://")) {
    prefixCode = 4;
    rest = url.slice(8);
  } else if (url.startsWith("http://")) {
    prefixCode = 3;
    rest = url.slice(7);
  }
  const payload = [prefixCode, ...Array.from(new TextEncoder().encode(rest))];
  return { tnf: 1, type: [0x55], id: [], payload };
}

function decodeNdefUriRecord(record) {
  if (!record.payload || record.payload.length === 0) {
    return "";
  }
  const prefixes = ["", "http://www.", "https://www.", "http://", "https://"];
  const prefix = prefixes[record.payload[0]] || "";
  const rest = new TextDecoder().decode(new Uint8Array(record.payload.slice(1)));
  return prefix + rest;
}

/* Wandelt einen rohen Byte-Record des nativen Plugins in die Form um,
   die formatNdefRecord() aus app.js erwartet (recordType + data als
   BufferSource) - so bleibt genau eine Formatierungsfunktion für beide
   Plattformen zuständig statt einer zweiten, parallelen Implementierung. */
function toWebNfcCompatibleRecord(nativeRecord) {
  const isUriRecord = nativeRecord.tnf === 1 && nativeRecord.type.length === 1 && nativeRecord.type[0] === 0x55;
  if (isUriRecord) {
    return { recordType: "url", data: new TextEncoder().encode(decodeNdefUriRecord(nativeRecord)) };
  }
  return { recordType: "unknown", data: new Uint8Array(nativeRecord.payload || []) };
}

/* Wartet auf genau einen Tag-Kontakt, über signal abbrechbar (gleiche
   Semantik wie scanNfcTagOnce() in app.js, inkl. AbortError beim Abbruch). */
function nativeScanTagOnce(signal) {
  const { CapacitorNfc } = nativePlugins();
  return new Promise((resolve, reject) => {
    let listenerHandle = null;
    let settled = false;

    function cleanup() {
      CapacitorNfc.stopScanning().catch(() => {});
      if (listenerHandle) {
        listenerHandle.remove();
      }
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
    }

    function onAbort() {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      const err = new Error("Scan abgebrochen.");
      err.name = "AbortError";
      reject(err);
    }

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort);
    }

    // Promise.resolve(...) statt direktem .then() - addListener() liefert je
    // nach Capacitor-/Plugin-Version nicht immer zuverlässig ein echtes
    // Promise zurück (beobachtet: ".then is not a function" zur Laufzeit).
    Promise.resolve(
      CapacitorNfc.addListener("nfcEvent", (event) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        const tag = event.tag || {};
        const serialNumber = (tag.id || []).map((b) => b.toString(16).padStart(2, "0")).join(":");
        const records = (tag.ndefMessage || []).map(toWebNfcCompatibleRecord);
        resolve({ serialNumber, message: { records } });
      })
    ).then((handle) => {
      listenerHandle = handle;
    });

    CapacitorNfc.startScanning().catch((err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

/* write() im Plugin schreibt auf "das zuletzt erkannte Tag" (eine intern
   gecachte Referenz). Wird write() aufgerufen, ohne vorher auf eine FRISCHE
   Tag-Erkennung in dieser Sitzung zu warten, kann diese Referenz noch von
   einer früheren Scan-Sitzung stammen (z.B. "Tag-Infos anzeigen" davor) -
   das native Tag-Objekt ist dann bereits ungültig und write() schlägt mit
   "Tag connection lost" (IllegalStateException) fehl, obwohl der aktuell
   aufgelegte Tag nie tatsächlich angesprochen wurde. Deshalb: immer erst
   auf ein frisches nfcEvent warten, dann erst schreiben. */
function nativeWriteTag(url) {
  const { CapacitorNfc } = nativePlugins();
  return new Promise((resolve, reject) => {
    let listenerHandle = null;
    let settled = false;

    function cleanup() {
      CapacitorNfc.stopScanning().catch(() => {});
      if (listenerHandle) {
        listenerHandle.remove();
      }
    }

    Promise.resolve(
      CapacitorNfc.addListener("nfcEvent", () => {
        if (settled) {
          return;
        }
        settled = true;
        CapacitorNfc.write({ records: [buildNdefUriRecord(url)] })
          .then(() => {
            cleanup();
            resolve();
          })
          .catch((err) => {
            cleanup();
            reject(err);
          });
      })
    ).then((handle) => {
      listenerHandle = handle;
    });

    CapacitorNfc.startScanning().catch((err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}
