"use strict";

let countdownInterval = null;

function initActionView(params) {
  document.getElementById("dashboard-view").hidden = true;
  document.getElementById("action-view").hidden = false;

  const type = params.get("type");
  const handlers = {
    timer: initTimerAction,
    contact: initContactAction,
    checkin: initCheckinAction,
    route: initRouteAction,
    link: initLinkAction,
    checklist: initChecklistAction,
  };

  if (handlers[type]) {
    handlers[type](params);
  } else {
    document.getElementById("action-content").innerHTML =
      `<div class="banner banner-error"><span class="icon">${ICONS.warning}</span><span>Unbekannter Tag-Typ.</span></div>`;
  }
}

/* ---------------- Timer ----------------
   Web NFC / Web-Plattform hat keinen zuverlässigen Weg, einen nativen
   Android-Alarm auszulösen (weder automatisch noch per Klick auf einen
   intent://-Link - Chrome blockiert das strukturell zu inkonsistent).
   Phase 1 setzt deshalb bewusst auf einen ehrlichen In-Page-Countdown.
   Ein zuverlässiger, auch bei geschlossener App laufender Alarm braucht
   die native Capacitor-Version (Phase 2, siehe PHASE2.md). */

async function initTimerAction(params) {
  const minutes = parseInt(params.get("min"), 10);
  const label = params.get("label") || "Timer";
  const content = document.getElementById("action-content");

  if (!Number.isFinite(minutes) || minutes <= 0) {
    content.innerHTML = `<div class="banner banner-error"><span class="icon">${ICONS.warning}</span><span>Dieser Tag enthält keine gültige Timer-Dauer.</span></div>`;
    return;
  }

  const seconds = minutes * 60;

  if (isNativePlatform()) {
    await initNativeTimerAction(seconds, label, content);
    return;
  }

  const notifySupported = "Notification" in window;

  content.innerHTML = `
    <div class="sticker-card type-timer action-card">
      <span class="action-icon">${ICONS.clock}</span>
      <p class="timer-label">${escapeForDisplay(label)}</p>
      <div class="countdown" id="countdown-display">--:--</div>
      ${notifySupported ? `<button type="button" id="notify-permission-btn" class="btn btn-accent-outline"><span class="icon">${ICONS.bell}</span>Benachrichtigung erlauben</button>` : ""}
      <button type="button" id="cancel-timer-btn" class="btn btn-secondary btn-block">Timer abbrechen</button>
      <p class="field-hint">Für einen zuverlässigen Alarm auch bei geschlossener App wird die Capacitor-Version benötigt (siehe unten).</p>
    </div>
  `;

  if (notifySupported && Notification.permission === "default") {
    const btn = document.getElementById("notify-permission-btn");
    btn.addEventListener("click", () => {
      Notification.requestPermission().then(() => {
        btn.remove();
      });
    });
  } else if (notifySupported && Notification.permission !== "default") {
    document.getElementById("notify-permission-btn")?.remove();
  }

  document.getElementById("cancel-timer-btn").addEventListener("click", () => {
    clearInterval(countdownInterval);
    window.location.href = "index.html";
  });

  startCountdown(seconds, label);
}

/* Native Capacitor-App: zuverlässiger System-Alarm über LocalNotifications
   statt In-Page-Countdown - läuft auch bei geschlossener App weiter und ist
   im Dashboard unter "Laufende Timer" abbrechbar (siehe native.js). */
async function initNativeTimerAction(seconds, label, content) {
  content.innerHTML = `
    <div class="sticker-card type-timer action-card">
      <span class="action-icon">${ICONS.clock}</span>
      <p class="timer-label">${escapeForDisplay(label)}</p>
      <p>Timer wird gestellt…</p>
    </div>
  `;

  try {
    await startNativeTimer(seconds, label);
    content.innerHTML = `
      <div class="sticker-card type-timer action-card">
        <span class="action-icon">${ICONS.clock}</span>
        <h1>${escapeForDisplay(label)}</h1>
        <div class="banner banner-success">
          <span class="icon">${ICONS.check}</span>
          <span>Timer gestellt - läuft auch weiter, wenn du die App schließt.</span>
        </div>
        <a href="index.html" class="btn btn-primary btn-block">Zur Übersicht</a>
        <p class="field-hint">Im Dashboard unter „Laufende Timer" jederzeit abbrechbar.</p>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="banner banner-error"><span class="icon">${ICONS.warning}</span><span>Timer konnte nicht gestellt werden: ${escapeForDisplay(err.message || String(err))}</span></div>
      <a href="index.html" class="btn btn-secondary btn-block">Zur Übersicht</a>
    `;
  }
}

function startCountdown(seconds, label) {
  const endTime = Date.now() + seconds * 1000;
  const display = document.getElementById("countdown-display");

  function tick() {
    const remainingMs = endTime - Date.now();
    if (remainingMs <= 0) {
      clearInterval(countdownInterval);
      display.textContent = "00:00";
      onTimerFinished(label);
      return;
    }
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    display.textContent = `${mm}:${ss}`;
  }

  tick();
  countdownInterval = setInterval(tick, 250);
}

function onTimerFinished(label) {
  if (navigator.vibrate) {
    navigator.vibrate([300, 150, 300, 150, 300]);
  }
  playBeeps();
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("Timer abgelaufen", { body: label });
  }
  document.getElementById("cancel-timer-btn")?.remove();
  const content = document.getElementById("action-content");
  const banner = document.createElement("div");
  banner.className = "banner banner-success";
  banner.innerHTML = `<span class="icon">${ICONS.bell}</span><span>Zeit abgelaufen!</span>`;
  content.prepend(banner);
}

function playBeeps() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const beepTimes = [0, 0.4, 0.8];
    for (const t of beepTimes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + t;
      osc.start(start);
      osc.stop(start + 0.3);
    }
  } catch {
    /* Web Audio evtl. blockiert - kein harter Fehler */
  }
}

/* ---------------- Kontakt ---------------- */

function initContactAction(params) {
  const name = params.get("name") || "";
  const tel = params.get("tel") || "";
  const msg = params.get("msg") || "";
  const notify = params.get("notify") === "1";

  document.getElementById("action-content").innerHTML = `
    <div class="sticker-card type-contact action-card">
      <span class="action-icon">${ICONS.contact}</span>
      <div class="contact-name">${escapeForDisplay(name)}</div>
      ${msg ? `<div class="contact-msg">${escapeForDisplay(msg)}</div>` : ""}
      <div class="action-buttons">
        ${tel ? `<a class="btn btn-accent" href="tel:${encodeURIComponent(tel)}"><span class="icon">${ICONS.phone}</span>Anrufen</a>` : ""}
        ${tel ? `<a class="btn btn-accent-outline" href="https://wa.me/${telToDigits(tel)}" target="_blank" rel="noopener"><span class="icon">${ICONS.chat}</span>WhatsApp</a>` : ""}
      </div>
    </div>
    <footer class="page-footer">Diese Seite gehört zu ${escapeForDisplay(name)} – falls gefunden, bitte melden.</footer>
  `;

  if (notify) {
    sendNotification("NFC Aktionen", `Tag gescannt: ${name || "Kontakt-Tag"}`);
  }
}

/* ---------------- Ankunfts-Check-in ---------------- */

function initCheckinAction(params) {
  const name = params.get("name") || "";
  const msg = params.get("msg") || "";

  document.getElementById("action-content").innerHTML = `
    <div class="sticker-card type-checkin action-card">
      <span class="action-icon">${ICONS.check}</span>
      <h1>Danke, ${escapeForDisplay(name || "du")} wurde benachrichtigt</h1>
      ${msg ? `<p>${escapeForDisplay(msg)}</p>` : ""}
    </div>
  `;

  sendNotification(name || "Check-in", msg || `${name || "Jemand"} ist angekommen.`);
}

/* ---------------- Navigation/Route ---------------- */

function initRouteAction(params) {
  const label = params.get("label") || "Route";
  const dest = params.get("dest") || "";
  const content = document.getElementById("action-content");

  if (!dest) {
    content.innerHTML = `<div class="banner banner-error"><span class="icon">${ICONS.warning}</span><span>Dieser Tag enthält kein Reiseziel.</span></div>`;
    return;
  }

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;

  content.innerHTML = `
    <div class="sticker-card type-route action-card">
      <span class="action-icon">${ICONS.route}</span>
      <h1>${escapeForDisplay(label)}</h1>
      <p>Route wird geöffnet…</p>
      <a class="btn btn-primary btn-block" href="${mapsUrl}">Route in Google Maps öffnen</a>
    </div>
  `;

  // Normale https://-Weiterleitung - anders als bei intent:// gibt es hier
  // keine Nutzer-Gesten-Einschränkung, ein automatischer Redirect ist sicher.
  window.location.href = mapsUrl;
}

/* ---------------- Freier Link ---------------- */

function initLinkAction(params) {
  const label = params.get("label") || "Link";
  const url = params.get("url") || "";
  const content = document.getElementById("action-content");

  if (!url || !isSafeRedirectUrl(url)) {
    content.innerHTML = `<div class="banner banner-error"><span class="icon">${ICONS.warning}</span><span>Dieser Tag enthält kein gültiges Link-Ziel.</span></div>`;
    return;
  }

  content.innerHTML = `
    <div class="sticker-card type-link action-card">
      <span class="action-icon">${ICONS.link}</span>
      <h1>${escapeForDisplay(label)}</h1>
      <p>Wird geöffnet…</p>
      <a class="btn btn-primary btn-block" href="${escapeForDisplay(url)}">${escapeForDisplay(label)} öffnen</a>
    </div>
  `;

  window.location.href = url;
}

/* ---------------- Checkliste ---------------- */

function initChecklistAction(params) {
  const label = params.get("label") || "Checkliste";
  const content = document.getElementById("action-content");

  let items = [];
  try {
    const parsed = JSON.parse(params.get("items") || "[]");
    if (Array.isArray(parsed)) {
      items = parsed.filter((item) => typeof item === "string" && item.trim().length > 0);
    }
  } catch {
    items = [];
  }

  if (items.length === 0) {
    content.innerHTML = `<div class="banner banner-error"><span class="icon">${ICONS.warning}</span><span>Diese Checkliste enthält keine Punkte.</span></div>`;
    return;
  }

  const itemsHtml = items
    .map(
      (item, i) => `
      <label class="checklist-item">
        <input type="checkbox" id="check-item-${i}">
        <span>${escapeForDisplay(item)}</span>
      </label>
    `
    )
    .join("");

  content.innerHTML = `
    <div class="sticker-card type-checklist action-card">
      <span class="action-icon">${ICONS.checklist}</span>
      <h1>${escapeForDisplay(label)}</h1>
      <div class="checklist-items">${itemsHtml}</div>
    </div>
  `;
}
