"use strict";

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
      params.set("topic", config.topic);
    }
  }

  base.search = params.toString();
  return base.toString();
}

/* =========================================================
   Benachrichtigungsdienst - austauschbar.
   Aktuell: ntfy.sh (kein Account nötig). Für einen anderen
   Dienst (z.B. Telegram-Bot) einfach diese Funktion ersetzen.
   ========================================================= */

async function sendNotification(topic, message) {
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      body: message,
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
