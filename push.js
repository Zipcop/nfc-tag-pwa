"use strict";

/* =========================================================
   Web-Push-Registrierung. Läuft ausschließlich im entsperrten
   Verwaltungsbereich (siehe lock.js: unlockDashboard() ruft
   initPushUI() auf) - im Kindermodus ist dieser Button nicht
   erreichbar, da der ganze #unlocked-dashboard-Container
   verborgen bleibt.
   ========================================================= */

const PUSH_SUBSCRIBED_KEY = "nfcPushSubscribed";
let pushListenerAttached = false;

function isPushSupported() {
  if (isNativePlatform()) {
    return true;
  }
  return "serviceWorker" in navigator && "PushManager" in window;
}

function hasStoredPushSubscription() {
  return localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "1";
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function initPushUI() {
  const btn = document.getElementById("push-subscribe-btn");
  if (!btn) {
    return;
  }
  if (!isPushSupported() || hasStoredPushSubscription()) {
    btn.hidden = true;
    return;
  }
  btn.hidden = false;
  if (!pushListenerAttached) {
    btn.addEventListener("click", handlePushSubscribeClick);
    pushListenerAttached = true;
  }
}

async function handlePushSubscribeClick() {
  const btn = document.getElementById("push-subscribe-btn");
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Wird eingerichtet…";

  try {
    if (isNativePlatform()) {
      await registerNativePush();
    } else {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch(`${PUSH_WORKER_URL}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": PUSH_API_KEY },
        body: JSON.stringify({ ownerId: getOwnerId(), ...subscription.toJSON() }),
      });
    }

    localStorage.setItem(PUSH_SUBSCRIBED_KEY, "1");
    btn.hidden = true;
  } catch (err) {
    console.warn("Push-Registrierung fehlgeschlagen:", err);
    btn.disabled = false;
    btn.textContent = originalText;
    alert(
      "Benachrichtigungen konnten nicht aktiviert werden. Bitte die Benachrichtigungs-Berechtigung für diese Seite in den Chrome-Einstellungen prüfen."
    );
  }
}
