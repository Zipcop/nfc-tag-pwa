"use strict";

/* =========================================================
   Web-Push-Konfiguration - nach dem Deployment von nfc-push-worker
   (separates Projekt, siehe dessen README) die Worker-URL eintragen.
   VAPID_PUBLIC_KEY und PUSH_API_KEY sind unkritisch (liegen ohnehin
   offen im Frontend-Code) - der private VAPID-Schlüssel existiert
   NUR als Worker-Secret und darf nie hierher.
   ========================================================= */

const PUSH_WORKER_URL = "https://nfc-push-worker.wargel59.workers.dev";
const PUSH_API_KEY = "Xhvfgb13non--eFOPqsrn3Xaj1thlHdh";
const VAPID_PUBLIC_KEY =
  "BNAVuVsSAtgTaz7e_kjh2iE0qfInSEHyZ-RgkNS7no00O4L61NqBNw03mFg0HUi0biY6fz7dMcypSb3icn7mk74";

/* =========================================================
   Storage: Tag-Konfigurationen liegen nur lokal auf diesem
   Handy in localStorage (kein Backend, keine Synchronisation).
   ========================================================= */

const STORAGE_KEY = "nfcTags";

function getTags() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getTag(id) {
  return getTags().find((t) => t.id === id) || null;
}

function saveTag(tag) {
  const tags = getTags();
  const idx = tags.findIndex((t) => t.id === tag.id);
  if (idx >= 0) {
    tags[idx] = tag;
  } else {
    tags.push(tag);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
}

function deleteTag(id) {
  const tags = getTags().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
}

function randomId(prefix) {
  const rand = Math.random().toString(36).slice(2, 10);
  return prefix ? `${prefix}-${rand}` : rand;
}

const TYPE_META = {
  timer: { icon: "clock", label: "Timer" },
  contact: { icon: "contact", label: "Kontakt" },
  checkin: { icon: "check", label: "Check-in" },
  route: { icon: "route", label: "Route" },
  link: { icon: "link", label: "Link" },
  checklist: { icon: "checklist", label: "Checkliste" },
};

function tagMetaText(tag) {
  switch (tag.type) {
    case "timer":
      return `Timer · ${tag.minutes} min`;
    case "contact":
      return `Kontakt · ${tag.notify ? "Push aktiv" : "Kein Push"}`;
    case "checkin":
      return "Check-in · Benachrichtigung";
    case "route":
      return `Route · ${truncateText(tag.dest, 28)}`;
    case "link":
      return `Link · ${hostnameOf(tag.url)}`;
    case "checklist":
      return `Checkliste · ${tag.items.length} Punkt${tag.items.length === 1 ? "" : "e"}`;
    default:
      return tag.type;
  }
}

function truncateText(text, max) {
  if (!text) {
    return "";
  }
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/* =========================================================
   URL-Building: aus einer Tag-Konfiguration die vollständige,
   korrekt encodete Ziel-URL bauen, die auf den Tag geschrieben wird.
   ========================================================= */

function buildTagUrl(config) {
  // index.html liegt im selben Verzeichnis wie diese Datei -
  // das funktioniert automatisch mit dem GitHub-Pages-Unterpfad.
  const base = new URL("index.html", window.location.href);
  const params = new URLSearchParams();
  params.set("type", config.type);

  if (config.type === "timer") {
    params.set("min", String(config.minutes));
    params.set("label", config.label);
  } else if (config.type === "contact") {
    params.set("name", config.name);
    params.set("tel", config.tel);
    params.set("msg", config.msg || "");
    if (config.notify) {
      params.set("notify", "1");
    }
  } else if (config.type === "checkin") {
    params.set("name", config.name);
    params.set("msg", config.msg || "");
  } else if (config.type === "route") {
    params.set("label", config.label);
    params.set("dest", config.dest);
  } else if (config.type === "link") {
    params.set("label", config.label);
    params.set("url", config.url);
  } else if (config.type === "checklist") {
    params.set("label", config.label);
    params.set("items", JSON.stringify(config.items));
  }

  base.search = params.toString();
  return base.toString();
}

/* Grobe Näherung der Byte-Größe einer URL als NDEF-URL-Record - gleiche
   Formel wie estimateNdefMessageSize, nur direkt auf dem URL-String. */
function estimateTagUrlSize(url) {
  const payloadLen = new TextEncoder().encode(url).length;
  return payloadLen + "url".length + 4;
}

/* Verhindert, dass ein manipulierter/fremder Tag mit z.B. einer
   javascript:-URL im "link"-Typ zu einer automatischen Codeausführung
   führt - nur https:// wird als Redirect-Ziel akzeptiert. */
function isSafeRedirectUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/* =========================================================
   Benachrichtigungsdienst - austauschbar.
   Aktuell: echte Web-Push-Benachrichtigungen über den separaten
   nfc-push-worker (Cloudflare Worker). Für einen anderen Dienst
   einfach diese Funktion ersetzen - der Rest der App kennt nur
   sendNotification(title, body).
   ========================================================= */

async function sendNotification(title, body) {
  try {
    await fetch(`${PUSH_WORKER_URL}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": PUSH_API_KEY },
      body: JSON.stringify({ title, body }),
    });
  } catch (err) {
    console.warn("Benachrichtigung konnte nicht gesendet werden:", err);
  }
}

/* =========================================================
   NFC-Schreiben
   ========================================================= */

function isWebNfcSupported() {
  return "NDEFReader" in window;
}

async function writeNfcTag(url) {
  const ndef = new NDEFReader();
  await ndef.write({ records: [{ recordType: "url", data: url }] });
}

/* Wartet auf genau ein Scan-Ergebnis (ein Tag-Kontakt) und liefert das
   NDEFReadingEvent zurück. Über signal abbrechbar (z.B. "Abbrechen"-Button). */
function scanNfcTagOnce(signal) {
  return new Promise((resolve, reject) => {
    const ndef = new NDEFReader();

    function cleanup() {
      ndef.removeEventListener("reading", onReading);
      ndef.removeEventListener("readingerror", onReadingError);
    }
    function onReading(event) {
      cleanup();
      resolve(event);
    }
    function onReadingError() {
      cleanup();
      reject(new Error("Tag konnte nicht gelesen werden."));
    }

    ndef.addEventListener("reading", onReading);
    ndef.addEventListener("readingerror", onReadingError);
    ndef.scan({ signal }).catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

/* Bringt einen NDEF-Record in eine für die Anzeige geeignete Form.
   Web NFC liefert nur Typ + Rohinhalt - keinen Chip-Typ, keine Kapazität. */
function formatNdefRecord(record) {
  const type = record.recordType || "unbekannt";
  if (record.recordType === "empty") {
    return { type, content: "(leer)" };
  }
  let content = "";
  try {
    if (record.data) {
      const decoder = new TextDecoder(record.encoding || "utf-8");
      content = decoder.decode(record.data);
    }
  } catch {
    content = "(Binärdaten, nicht als Text darstellbar)";
  }
  return { type, content: content || "(kein Inhalt)" };
}

/* Grobe Näherung der Nachrichtengröße in Byte (Payload + Typ + kleiner
   Header-Zuschlag pro Record) - kein exaktes Maß für die Speicherkapazität. */
function estimateNdefMessageSize(records) {
  return records.reduce((sum, r) => {
    const payloadLen = r.data ? r.data.byteLength : 0;
    const typeLen = r.recordType ? r.recordType.length : 0;
    return sum + payloadLen + typeLen + 4;
  }, 0);
}

/* =========================================================
   Hilfsfunktionen
   ========================================================= */

function escapeForDisplay(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function telToDigits(tel) {
  return tel.replace(/[^\d]/g, "");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      /* Offline-Installierbarkeit ist ein Nice-to-have, kein Blocker */
    });
  }
}
