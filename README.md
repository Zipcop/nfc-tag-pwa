# NFC Aktionen

Eine kleine Progressive Web App, mit der du NFC-Tags beschreiben kannst. Hältst du danach das Handy an den Tag (deins oder ein fremdes), passiert automatisch eine vorher festgelegte Aktion – z.B. startet ein Timer oder es wird eine Kontaktkarte mit Anruf-/WhatsApp-Button angezeigt.

Läuft komplett im Browser, ohne eigenen Server – gehostet über GitHub Pages.

## Voraussetzungen

- Ein Android-Handy mit NFC (zum **Beschreiben** von Tags)
- Chrome, Edge oder Samsung Internet auf dem Handy (Web-NFC funktioniert nur dort, nicht auf dem iPhone und nicht am Desktop-PC)
- NFC-Tags (z.B. NTAG213/215/216-Sticker oder -Karten)
- Optional: die kostenlose **ntfy-App**, falls du bei einem Kontakt-Tag benachrichtigt werden willst, sobald jemand ihn scannt

## Schritt 1: NFC am Handy aktivieren

Einstellungen → Verbindungen → NFC und kontaktloses Bezahlen → NFC einschalten (Wortlaut je nach Android-Version leicht anders).

## Schritt 2: ntfy-App installieren (nur falls gewünscht)

1. Im Play Store „ntfy" installieren.
2. Die App öffnen – ein Thema/Topic abonnierst du erst, wenn du einen Kontakt-Tag mit aktivierter Benachrichtigung eingerichtet hast (siehe Schritt 3). Die App zeigt dir dann das genaue Thema an, das du abonnieren musst.

## Schritt 3: Einen Tag einrichten

1. Öffne die Web-App in Chrome auf deinem Handy.
2. Tippe auf **„+ Neuen Tag einrichten"**.
3. Wähle den Typ:
   - **Timer**: Minuten und ein Label eingeben (z.B. „90" / „Waschmaschine").
   - **Kontakt**: Name, Telefonnummer, eine Nachricht sowie optional den Schalter „Mich per Push benachrichtigen, wenn gescannt" aktivieren.
4. Tippe auf **„Auf NFC-Tag schreiben"**.
5. Halte einen leeren NFC-Tag ans Handy, sobald „Bitte Tag jetzt ans Handy halten…" erscheint.
6. Nach erfolgreichem Schreiben landest du wieder im Dashboard – der Tag ist jetzt einsatzbereit.

## Einen Tag benutzen

Handy (egal ob mit oder ohne diese App installiert) einfach an den beschriebenen Tag halten:

- **Timer-Tag**: Die Uhr-App startet automatisch einen Timer.
- **Kontakt-Tag**: Es öffnet sich eine Seite mit Name, Nachricht und Buttons zum Anrufen/WhatsApp-Schreiben.

Das funktioniert auch auf fremden Handys und sogar auf iPhones – die brauchen dafür kein Web-NFC, das Betriebssystem öffnet einfach die im Tag gespeicherte Adresse im Browser.

## Einen Tag bearbeiten / neu beschreiben / löschen

Im Dashboard hat jeder Eintrag drei Buttons:

- **Bearbeiten**: Angaben ändern und danach erneut auf denselben (oder einen neuen) Tag schreiben.
- **Erneut auf Tag schreiben**: Dieselben Angaben unverändert auf einen weiteren/Ersatz-Tag schreiben.
- **Löschen**: Entfernt den Eintrag nur aus der App-Liste auf diesem Handy, nicht vom physischen Tag.

## Wichtig zu wissen

- Die Liste deiner Tags wird nur lokal auf **diesem** Handy gespeichert (kein Konto, keine Synchronisation zwischen Geräten).
- Beschreiben von Tags funktioniert nur auf Android mit Chrome/Edge/Samsung Internet. Öffnest du die App am PC oder auf dem iPhone, erscheint stattdessen ein Hinweis.
- Beim Timer versucht die App zuerst, den Timer direkt an die native Uhr-App zu übergeben (läuft dann zuverlässig weiter, auch wenn der Tab geschlossen wird). Klappt das auf einem Gerät ausnahmsweise nicht, springt automatisch ein Countdown direkt in der Seite ein – dafür muss die Seite dann aber geöffnet bleiben.

## Für Entwickler: lokal testen

```
npx serve .
```

oder ein beliebiger anderer statischer Webserver im Projektordner. NFC-Funktionen lassen sich nur auf einem echten Android-Handy testen (HTTPS erforderlich – z.B. über GitHub Pages oder einen Tunnel wie ngrok).

## Deployment auf GitHub Pages

1. Repo-Inhalt auf GitHub pushen.
2. Repo-Einstellungen → Pages → Branch auswählen, unter dem die Dateien liegen.
3. Die Seite ist danach unter `https://<username>.github.io/<repo>/` erreichbar.
