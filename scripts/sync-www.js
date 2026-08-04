"use strict";

/* Kopiert die bestehenden Phase-1-Web-Dateien unverändert in www/, das
   Capacitor beim Bauen der nativen App verpackt. Einfacher, expliziter
   Kopierschritt statt Symlink/webDir-Trick, damit GitHub Pages weiterhin
   direkt aus dem Repo-Root bedient wird (Phase 1 bleibt unverändert) und
   www/ nur der Capacitor-Build-Input ist. Nach jeder Änderung an den
   Phase-1-Dateien vor einem nativen Build erneut ausführen: npm run sync-www */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WWW = path.join(ROOT, "www");

const FILES = [
  "index.html",
  "setup.html",
  "style.css",
  "icons.js",
  "native.js",
  "app.js",
  "dashboard.js",
  "action.js",
  "setup.js",
  "nfc-tools.js",
  "lock.js",
  "push.js",
  "service-worker.js",
  "manifest.json",
];

const DIRS = ["icons"];

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

for (const file of FILES) {
  fs.copyFileSync(path.join(ROOT, file), path.join(WWW, file));
}
for (const dir of DIRS) {
  copyDirRecursive(path.join(ROOT, dir), path.join(WWW, dir));
}

console.log(`www/ synchronisiert (${FILES.length} Dateien, ${DIRS.length} Ordner).`);
