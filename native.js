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

/* ---------------- Timer (Android-Uhr-App) ---------------- */

/* Übergibt den Timer an die installierte Uhr-App (SystemTimerPlugin,
   siehe MainActivity.java) - läuft dort mit deren eigenem
   Countdown/Sound/Vibration. Trade-off: kein Abbrechen über diese App
   möglich, nur noch über die Uhr-App selbst. */
async function startSystemTimer(seconds, label) {
  const { SystemTimer } = nativePlugins();
  await SystemTimer.startTimer({ seconds, label });
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
          body: JSON.stringify({ ownerId: getOwnerId(), fcmToken: token.value }),
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

/* ---------------- Tag-Dispatch-Koordination ----------------
   Solange die Nutzerin einen Tag bewusst zum Lesen/Schreiben ans Handy
   hält (Setup-Screen offen, Tag-Infos-Modal offen), kann Androids eigener
   NFC-Intent-Dispatch (MainActivity.handleTagIntent) denselben Tag-Scan
   parallel als ACTION_VIEW/NDEF_DISCOVERED an die WebView weiterreichen
   und ungewollt die im Tag hinterlegte Aktion laden - siehe
   TagDispatchControlPlugin. suppressTagDispatch()/resumeTagDispatch()
   werden deshalb NICHT hier um die kurzen nativeWriteTag()/
   nativeScanTagOnce()-Aufrufe herum aufgerufen (das Fenster wäre zu kurz -
   z.B. während des Formular-Ausfüllens zwischen Scan und Schreiben bleibt
   der Tag oft weiter am Handy), sondern vom jeweiligen Aufrufer für die
   gesamte Dauer der bewussten NFC-Interaktion (siehe setup.js/initSetup()
   und nfc-tools.js/openTagInfoModal()+closeModal()). */

async function suppressTagDispatch() {
  const { TagDispatchControl } = nativePlugins();
  await TagDispatchControl.suppress();
}
async function resumeTagDispatch() {
  const { TagDispatchControl } = nativePlugins();
  await TagDispatchControl.resume().catch(() => {});
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
   gecachte Referenz), die bei jedem nfcEvent neu gesetzt wird. Das Plugin
   liest dabei VOR dem nfcEvent immer erst den vorhandenen NDEF-Inhalt
   (u.a. seitenweise über MifareUltralight) - bei Tags mit bereits
   vorhandenem Inhalt (z.B. von früheren Testschreibvorgängen) dauert das
   spürbar länger, und der anschließende Verbindungswechsel auf die
   Ndef-Technologie für den eigentlichen Schreibvorgang schlägt dann mit
   "Tag connection lost" fehl - reproduzierbar bei JEDEM Versuch auf
   demselben Tag-Objekt, ein erneuter write()-Aufruf auf genau diesem
   Objekt bringt also nichts (bereits getestet, gleicher Fehler jedes
   Mal). Stattdessen: Listener nach einem fehlgeschlagenen Versuch NICHT
   entfernen, sondern auf das nächste nfcEvent warten - selbst bei
   "festem" Auflegen erzeugt minimales Zittern der Hand meist erneute
   Erkennungen, die dann ein frisches, noch unberührtes Tag-Objekt
   liefern. Nach WRITE_MAX_ATTEMPTS Versuchen bzw. WRITE_TIMEOUT_MS wird
   endgültig aufgegeben. */
const WRITE_MAX_ATTEMPTS = 6;
const WRITE_TIMEOUT_MS = 15000;

function nativeWriteTag(url) {
  const { CapacitorNfc } = nativePlugins();
  return new Promise((resolve, reject) => {
    let listenerHandle = null;
    let settled = false;
    let writing = false;
    let attempts = 0;
    let timeoutId = null;

    function cleanup() {
      clearTimeout(timeoutId);
      CapacitorNfc.stopScanning().catch(() => {});
      if (listenerHandle) {
        listenerHandle.remove();
      }
    }

    function fail(err) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(err);
    }

    function succeed() {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    }

    timeoutId = setTimeout(() => {
      fail(new Error("Zeitüberschreitung beim Schreiben. Tag bitte kurz abheben und erneut auflegen."));
    }, WRITE_TIMEOUT_MS);

    const record = buildNdefUriRecord(url);

    Promise.resolve(
      CapacitorNfc.addListener("nfcEvent", () => {
        if (settled || writing) {
          return;
        }
        writing = true;
        attempts++;
        CapacitorNfc.write({ records: [record] })
          .then(() => {
            succeed();
          })
          .catch((err) => {
            writing = false;
            if (attempts >= WRITE_MAX_ATTEMPTS) {
              fail(err);
            }
            // sonst: weiter auf das nächste nfcEvent warten (frisches Tag-Objekt)
          });
      })
    ).then((handle) => {
      listenerHandle = handle;
    });

    CapacitorNfc.startScanning().catch((err) => {
      fail(err);
    });
  });
}
