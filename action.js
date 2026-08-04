"use strict";

let countdownInterval = null;

function initActionView(params) {
  document.getElementById("dashboard-view").hidden = true;
  document.getElementById("action-view").hidden = false;

  const type = params.get("type");
  if (type === "timer") {
    initTimerAction(params);
  } else if (type === "contact") {
    initContactAction(params);
  } else {
    document.getElementById("action-content").innerHTML =
      `<div class="banner banner-error"><span class="icon">${ICONS.warning}</span><span>Unbekannter Tag-Typ.</span></div>`;
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
  const content = document.getElementById("action-content");

  if (!Number.isFinite(minutes) || minutes <= 0) {
    content.innerHTML = `<div class="banner banner-error"><span class="icon">${ICONS.warning}</span><span>Dieser Tag enthält keine gültige Timer-Dauer.</span></div>`;
    return;
  }

  const seconds = minutes * 60;
  const intentUrl = buildTimerIntentUrl(label, seconds);
  const notifySupported = "Notification" in window;

  content.innerHTML = `
    <div class="action-stack">
      <div class="sticker-card type-timer action-card">
        <span class="action-icon">${ICONS.clock}</span>
        <h1>${escapeForDisplay(label)}</h1>
        <button type="button" id="start-timer-btn" class="btn btn-primary btn-block">
          <span class="icon">${ICONS.clock}</span>Timer in der Uhr-App starten
        </button>
        <p class="field-hint">Falls sich nichts öffnet, ist auf diesem Gerät keine Uhr-App mit Timer-Funktion verfügbar.</p>
      </div>
      <div class="sticker-card type-timer action-card">
        <p class="timer-label">Alternativ: Countdown direkt hier in der Seite</p>
        <div class="countdown" id="countdown-display">--:--</div>
        ${notifySupported ? `<button type="button" id="notify-permission-btn" class="btn btn-accent-outline"><span class="icon">${ICONS.bell}</span>Benachrichtigung erlauben</button>` : ""}
        <p class="field-hint">Dafür bitte diesen Tab bzw. die App offen lassen – im Hintergrund kann das Handy den Countdown pausieren.</p>
      </div>
    </div>
  `;

  // Der Intent wird ausschließlich über den Klick auf diesen Button ausgelöst -
  // ein echter Tap ist immer eine gültige Nutzer-Geste. Kein automatischer
  // Redirect beim Laden mehr (wurde von Chrome teils stillschweigend blockiert).
  document.getElementById("start-timer-btn").addEventListener("click", () => {
    window.location.href = intentUrl;
  });

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

  startCountdown(seconds, label);
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
  const topic = params.get("topic") || "";

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

  if (notify && topic) {
    sendNotification(topic, `Tag gescannt: ${name || "Kontakt-Tag"}`);
  }
}
