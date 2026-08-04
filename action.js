"use strict";

let countdownInterval = null;

function initActionView(params) {
  document.getElementById("dashboard-view").hidden = true;
  const view = document.getElementById("action-view");
  view.hidden = false;

  const type = params.get("type");
  if (type === "timer") {
    initTimerAction(params);
  } else if (type === "contact") {
    initContactAction(params);
  } else {
    view.innerHTML = `<div class="banner banner-error"><span class="icon">${ICONS.warning}</span><span>Unbekannter Tag-Typ.</span></div>`;
  }
}

/* ---------------- Timer ---------------- */

function buildTimerIntentUrl(label, seconds) {
  return (
    "intent://timer/#Intent;" +
    "action=android.intent.action.SET_TIMER;" +
    `S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(label)};` +
    `i.android.intent.extra.alarm.LENGTH=${seconds};` +
    "B.android.intent.extra.alarm.SKIP_UI=true;" +
    "end"
  );
}

function initTimerAction(params) {
  const minutes = parseInt(params.get("min"), 10);
  const label = params.get("label") || "Timer";
  const view = document.getElementById("action-view");

  if (!Number.isFinite(minutes) || minutes <= 0) {
    view.innerHTML = `<div class="banner banner-error"><span class="icon">${ICONS.warning}</span><span>Dieser Tag enthält keine gültige Timer-Dauer.</span></div>`;
    return;
  }

  const seconds = minutes * 60;
  const intentUrl = buildTimerIntentUrl(label, seconds);

  // Der Redirect muss die allererste Aktion sein - kein DOM-Update, kein
  // await/setTimeout davor. Sonst wertet Chrome ihn nicht mehr als an die
  // Nutzer-Geste (Tap auf die Scan-Benachrichtigung) gekoppelt und blockiert
  // den App-Aufruf stillschweigend.
  window.location.href = intentUrl;

  view.innerHTML = `
    <div class="sticker-card type-timer action-card">
      <span class="action-icon">${ICONS.clock}</span>
      <h1>${escapeForDisplay(label)}</h1>
      <p>Timer wird gestartet…</p>
      <button type="button" id="manual-timer-btn" class="btn btn-primary btn-block">
        <span class="icon">${ICONS.clock}</span>Timer jetzt starten
      </button>
      <p class="field-hint">Falls sich die Uhr-App nicht automatisch öffnet, tippe oben auf den Button.</p>
    </div>
  `;
  document.getElementById("manual-timer-btn").addEventListener("click", () => {
    window.location.href = intentUrl;
  });

  // Falls der Intent nicht greift (z.B. anderes Gerät/Browser), bleibt die
  // Seite sichtbar - dann auf den In-Page-Countdown zurückfallen.
  setTimeout(() => {
    if (document.visibilityState === "visible") {
      startFallbackCountdown(seconds, label);
    }
  }, 1500);
}

function startFallbackCountdown(seconds, label) {
  const view = document.getElementById("action-view");
  const endTime = Date.now() + seconds * 1000;
  const notifySupported = "Notification" in window;

  view.innerHTML = `
    <div class="banner banner-warning">
      <span class="icon">${ICONS.warning}</span>
      <span>Der native Timer konnte nicht automatisch gestartet werden. Countdown läuft stattdessen hier in der Seite.</span>
    </div>
    <div class="sticker-card type-timer action-card">
      <p class="timer-label">${escapeForDisplay(label)}</p>
      <div class="countdown" id="countdown-display">--:--</div>
      ${notifySupported ? `<button id="notify-permission-btn" class="btn btn-accent-outline"><span class="icon">${ICONS.bell}</span>Benachrichtigung erlauben</button>` : ""}
      <p class="field-hint">Für einen zuverlässigen Alarm bitte diesen Tab bzw. die App offen lassen – im Hintergrund kann das Handy den Timer pausieren.</p>
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
  const view = document.getElementById("action-view");
  const banner = document.createElement("div");
  banner.className = "banner banner-success";
  banner.innerHTML = `<span class="icon">${ICONS.bell}</span><span>Zeit abgelaufen!</span>`;
  view.prepend(banner);
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
  const topic = params.get("topic") || "";

  const view = document.getElementById("action-view");
  view.innerHTML = `
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

  if (notify && topic) {
    sendNotification(topic, `Tag gescannt: ${name || "Kontakt-Tag"}`);
  }
}
