"use strict";

/* Eigene, einfache Strich-Icons (kein Icon-Font, keine Bibliothek).
   Alle nutzen currentColor, damit die Farbe per CSS gesteuert wird. */

const ICONS = {
  clock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',

  contact:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="3"/><circle cx="8.5" cy="12" r="2"/><path d="M13.2 10h4M13.2 14h2.6"/></svg>',

  plus:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',

  kebab:
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="18.5" r="1.7" fill="currentColor"/></svg>',

  phone:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.6 3.5h3l1.6 4.2-2.2 1.6a11.5 11.5 0 0 0 5.2 5.2l1.6-2.2 4.2 1.6v3a1.8 1.8 0 0 1-2 1.8A15.8 15.8 0 0 1 4.8 5.5a1.8 1.8 0 0 1 1.8-2z"/></svg>',

  chat:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.3a8 8 0 1 1 3.3 6.4L4 20l1.2-3.7A7.9 7.9 0 0 1 4 12.3z"/><path d="M8.7 11.2h6.6M8.7 14.2h4.2"/></svg>',

  bell:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 10a5.5 5.5 0 1 1 11 0c0 3.6 1.3 5 1.3 5h-13.6s1.3-1.4 1.3-5z"/><path d="M10.2 18.5a1.9 1.9 0 0 0 3.6 0"/></svg>',

  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l5 5L19.5 6.5"/></svg>',

  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',

  warning:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.2 20.8 19H3.2z"/><path d="M12 10v4M12 16.7h.01"/></svg>',

  ripple:
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor"><circle cx="24" cy="24" r="3" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="11" stroke-width="2" opacity="0.55"/><circle cx="24" cy="24" r="19" stroke-width="2" opacity="0.25"/></svg>',

  logo:
    '<svg viewBox="0 0 30 18" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="1" width="28" height="16" rx="8"/><circle cx="9" cy="9" r="4.2" fill="currentColor" stroke="none"/></svg>',

  back:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',

  info:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 7.8h.01"/></svg>',
};

/* Füllt alle Elemente mit [data-icon="name"] mit dem passenden SVG.
   Für dynamisch per JS erzeugte Karten wird ICONS.<name> direkt in
   Template-Strings eingesetzt, dafür ist diese Funktion nicht nötig. */
function hydrateIcons(root) {
  (root || document).querySelectorAll("[data-icon]").forEach((el) => {
    const svg = ICONS[el.dataset.icon];
    if (svg) {
      el.innerHTML = svg;
    }
  });
}
