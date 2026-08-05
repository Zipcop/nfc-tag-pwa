"use strict";

/* =========================================================
   Design-Einstellungen: drei feste Presets + eine aus einer
   einzigen Hauptfarbe automatisch abgeleitete "Eigene Farbe".
   Wird als eigenständige Datei geladen (auch ganz früh im <head>,
   noch vor dem Rest der App), damit applyStoredTheme()/
   applyStoredFontScale() das gespeicherte Theme anwenden können,
   bevor irgendetwas sichtbar gerendert wird (kein Aufblitzen).
   ========================================================= */

/* ---------------- Hex/HSL-Konvertierung ---------------- */

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n) => Math.round(255 * f(n)).toString(16).padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`.toUpperCase();
}

/* ---------------- WCAG-Kontrast ---------------- */

function relativeLuminance(hex) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrastRatio(hex1, hex2) {
  const L1 = relativeLuminance(hex1);
  const L2 = relativeLuminance(hex2);
  const [light, dark] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (light + 0.05) / (dark + 0.05);
}

// Schiebt die Helligkeit so lange in Richtung "lighter"/"darker", bis der
// Kontrast zu bgHex den WCAG-AA-Mindestwert (4.5) erreicht.
function ensureContrast(h, s, l, bgHex, direction) {
  let hex = hslToHex(h, s, l);
  let guard = 0;
  while (contrastRatio(hex, bgHex) < 4.5 && guard < 40) {
    l += direction === "lighter" ? 2 : -2;
    l = Math.max(0, Math.min(100, l));
    hex = hslToHex(h, s, l);
    guard++;
  }
  return hex;
}

// Wählt hellen oder dunklen Text, je nachdem was auf bgHex besser lesbar ist.
function pickReadableText(bgHex) {
  return contrastRatio(bgHex, "#000000") > contrastRatio(bgHex, "#FFFFFF") ? "#1A1108" : "#FFFFFF";
}

/* ---------------- Eigene Farbe -> vollständige Farbwelt ---------------- */

function buildThemeFromColor(primaryHex) {
  const { h, s, l } = hexToHsl(primaryHex);
  const h2 = (h + 150) % 360; // zweite Akzentfarbe, deutlich abgesetzter Farbton

  const bg = hslToHex(h, Math.min(s, 15), 9);
  const card = hslToHex(h, Math.min(s, 12), 95);
  const ink = "#211D18";

  const amber = ensureContrast(h, Math.max(s, 45), Math.min(Math.max(l, 40), 60), card, "darker");
  const teal = ensureContrast(h2, Math.max(s, 40), Math.min(Math.max(l, 35), 55), card, "darker");
  const fog = ensureContrast(h, Math.min(s, 10), 60, bg, "lighter");
  const line = hslToHex(h, Math.min(s, 15), 18);
  const amberBg = hslToHex(h, Math.min(s * 0.5, 35), 90);
  const tealBg = hslToHex(h2, Math.min(s * 0.5, 35), 90);

  return { bg, card, ink, amber, amberBg, teal, tealBg, fog, line, buttonText: pickReadableText(amber) };
}

/* ---------------- Presets ---------------- */

const THEME_PRESETS = {
  werkstatt: {
    bg: "#14171C",
    card: "#F6F1E7",
    ink: "#211D18",
    amber: "#E8873D",
    amberBg: "#F7E4D0",
    teal: "#3F7368",
    tealBg: "#DCEAE6",
    fog: "#8B909B",
    line: "#262B33",
  },
  hell: {
    bg: "#F3EFE6",
    card: "#FFFFFF",
    ink: "#211D18",
    amber: "#C96A1F",
    amberBg: "#FCE7D2",
    teal: "#2F5D54",
    tealBg: "#E1EEEA",
    fog: "#6B7280",
    line: "#DDD6C8",
  },
  kontrast: {
    bg: "#000000",
    card: "#FFFFFF",
    ink: "#000000",
    amber: "#FF8C00",
    amberBg: "#FFFFFF",
    teal: "#00897B",
    tealBg: "#FFFFFF",
    fog: "#B0B0B0",
    line: "#FFFFFF",
  },
};

const THEME_TILES = [
  { mode: "werkstatt", label: "Werkstatt Dunkel" },
  { mode: "hell", label: "Hell & Freundlich" },
  { mode: "kontrast", label: "Hoher Kontrast" },
];

/* ---------------- Speicherung + Anwendung ---------------- */

const THEME_MODE_KEY = "themeMode";
const CUSTOM_PRIMARY_HEX_KEY = "customPrimaryHex";
const FONT_SCALE_KEY = "fontScale";
const FONT_SCALE_PERCENT = { klein: 100, normal: 115, gross: 130 };

// custom wird bei jedem Aufruf live aus dem gespeicherten Hex-Wert neu
// berechnet statt als fertige Werte gespeichert - Verbesserungen an der
// Formel gelten damit automatisch auch für schon gewählte eigene Farben.
function resolveThemeVars(mode) {
  if (mode === "custom") {
    const hex = localStorage.getItem(CUSTOM_PRIMARY_HEX_KEY) || THEME_PRESETS.werkstatt.amber;
    return buildThemeFromColor(hex);
  }
  return THEME_PRESETS[mode] || THEME_PRESETS.werkstatt;
}

function applyThemeVars(vars) {
  const root = document.documentElement.style;
  root.setProperty("--bg", vars.bg);
  root.setProperty("--card", vars.card);
  root.setProperty("--ink", vars.ink);
  root.setProperty("--amber", vars.amber);
  root.setProperty("--amber-bg", vars.amberBg);
  root.setProperty("--teal", vars.teal);
  root.setProperty("--teal-bg", vars.tealBg);
  root.setProperty("--fog", vars.fog);
  root.setProperty("--line", vars.line);
  root.setProperty("--button-text", vars.buttonText || pickReadableText(vars.amber));
}

function applyStoredTheme() {
  const mode = localStorage.getItem(THEME_MODE_KEY) || "werkstatt";
  applyThemeVars(resolveThemeVars(mode));
}

function setThemeMode(mode, customHex) {
  localStorage.setItem(THEME_MODE_KEY, mode);
  if (mode === "custom" && customHex) {
    localStorage.setItem(CUSTOM_PRIMARY_HEX_KEY, customHex);
  }
  applyStoredTheme();
}

function applyStoredFontScale() {
  const scale = localStorage.getItem(FONT_SCALE_KEY) || "klein";
  const percent = FONT_SCALE_PERCENT[scale] || 100;
  document.documentElement.style.setProperty("--font-scale", percent / 100);
}

function setFontScale(scale) {
  localStorage.setItem(FONT_SCALE_KEY, scale);
  applyStoredFontScale();
}
