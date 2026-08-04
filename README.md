# NFC Aktionen

Eine kleine Progressive Web App, mit der du NFC-Tags beschreiben kannst. Hältst du danach das Handy an den Tag (deins oder ein fremdes), passiert automatisch eine vorher festgelegte Aktion – z.B. startet ein Timer oder es wird eine Kontaktkarte mit Anruf-/WhatsApp-Button angezeigt.

Läuft komplett im Browser, ohne eigenen Server – gehostet über GitHub Pages.

## Kindermodus / PIN-Schutz

Die App öffnet sich standardmäßig **gesperrt**: keine Tag-Liste, keine Buttons – nur ein großes Symbol mit „Halte einen Tag ans Handy" und oben ein kleines Schloss-Symbol. So kann ein Kind die App öffnen und trotzdem nichts an der Verwaltung verändern.

- **Beim allerersten Öffnen** fragt die App einmalig nach einem selbstgewählten 4-stelligen PIN (zweimal eingeben zur Bestätigung). Der PIN wird nicht im Klartext gespeichert, sondern nur als SHA-256-Hash in `localStorage` – das ist **kein Schutz gegen technisch versierte Erwachsene**, reicht aber, um Kinder von der Verwaltung fernzuhalten.
- Tippe auf das Schloss-Symbol und gib den PIN über das Zahlenpad ein, um die Verwaltung (Tag-Liste, Bearbeiten, Neuen Tag einrichten, …) freizuschalten.
- Nach 5 Minuten ohne Aktivität oder wenn die App komplett geschlossen wird, sperrt sie sich automatisch wieder.
- **PIN vergessen?** Es gibt keine „PIN vergessen"-Mail, da die App kein Backend/Konto hat. Einzige Möglichkeit: in Chrome unter Website-Einstellungen die Daten dieser Seite löschen. Das setzt den PIN zurück, löscht dabei aber auch die lokal gespeicherte Liste der Tag-Konfigurationen auf diesem Handy. **Die physischen Tags selbst funktionieren beim Scannen weiterhin ganz normal** – nur die Übersicht/Bearbeitungsmöglichkeit in der App geht verloren.

Wichtig: Dieser Schutz betrifft **nur** die Verwaltung. Scannt ein Kind einen fertigen Tag, passiert die hinterlegte Aktion (Timer, Kontakt, Route, Checkliste, Check-in) sofort und ganz normal – ohne PIN, ohne die App überhaupt zu öffnen.

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

Dafür sind in der Regel **zwei kurze Kontakte** mit dem Handy nötig – einmal zum Erkennen, einmal zum Speichern:

1. Öffne die Web-App in Chrome auf deinem Handy und entsperre die Verwaltung mit deinem PIN (siehe oben).
2. Tippe auf **„+ Neuen Tag einrichten"**.
3. Halte den NFC-Tag ans Handy, sobald „Tag jetzt ans Handy halten" erscheint (**erster Kontakt**). Die App liest ihn kurz aus:
   - Ist er leer, geht es direkt weiter.
   - Enthält er bereits andere Daten, zeigt die App kurz Inhalt und Seriennummer mit dem Hinweis „Wird beim Speichern überschrieben".
4. Jetzt erscheint das Formular: erst Name/Label eingeben, dann den Typ wählen:
   - **Timer**: zusätzlich die Minuten eingeben.
   - **Kontakt**: zusätzlich Telefonnummer, eine Nachricht sowie optional den Schalter „Mich per Push benachrichtigen, wenn gescannt" aktivieren.
   - **Check-in**: zusätzlich eine Nachricht eingeben (z.B. „ist zuhause angekommen") – benachrichtigt beim Scannen immer automatisch per Push.
   - **Route**: zusätzlich eine Zieladresse eingeben – öffnet beim Scannen automatisch Google Maps mit dieser Route.
   - **Link**: zusätzlich eine Ziel-URL eingeben (muss mit `https://` beginnen) – öffnet beim Scannen automatisch diese Seite (z.B. eine Playlist oder ein Video).
   - **Checkliste**: zusätzlich beliebig viele Punkte eingeben („+ Punkt hinzufügen") – zeigt beim Scannen eine abhakbare Liste, ohne etwas zu speichern.
5. Tippe auf **„Fertig – Tag beschreiben"** und halte den Tag noch einmal ans Handy (**zweiter Kontakt**).
6. Nach erfolgreichem Schreiben landest du wieder im Dashboard – der Tag ist jetzt einsatzbereit.

Direkt über dem Button zeigt die App die geschätzte Größe der Tag-Daten in Byte an. NFC-Tags haben je nach Chip nur wenig Speicher (z.B. NTAG213: 144 Byte) – bei langen Checklisten oder Nachrichten kann das knapp werden. Ab ca. 130 Byte erscheint ein Warnhinweis; das ist nur ein Hinweis, kein hartes Limit.

## Einen Tag benutzen

Handy (egal ob mit oder ohne diese App installiert) einfach an den beschriebenen Tag halten. Die sich öffnende Seite hat oben immer einen Link „← Zur Übersicht" zurück zum Dashboard.

- **Timer-Tag**: Ein Countdown läuft direkt in der Seite, mit Button „Timer abbrechen". Für einen zuverlässigen Alarm auch bei geschlossener App wird die native Capacitor-Version benötigt (siehe [PHASE2.md](PHASE2.md)) – Web-Technik hat keinen zuverlässigen Weg, einen echten Android-Alarm auszulösen.
- **Kontakt-Tag**: Es öffnet sich eine Seite mit Name, Nachricht und Buttons zum Anrufen/WhatsApp-Schreiben.
- **Check-in-Tag**: Verschickt automatisch eine Push-Benachrichtigung und zeigt eine Bestätigung „Danke, [Name] wurde benachrichtigt".
- **Route-Tag**: Öffnet automatisch Google Maps mit der hinterlegten Zieladresse.
- **Link-Tag**: Öffnet automatisch die hinterlegte Seite.
- **Checkliste-Tag**: Zeigt die Punkte als Checkboxen zum Abhaken während des aktuellen Besuchs (nichts wird gespeichert).

Das funktioniert auch auf fremden Handys und sogar auf iPhones – die brauchen dafür kein Web-NFC, das Betriebssystem öffnet einfach die im Tag gespeicherte Adresse im Browser.

## Einen Tag bearbeiten / neu beschreiben / entfernen

Im Dashboard hat jeder Eintrag ein ⋮-Menü mit drei Aktionen:

- **Bearbeiten**: Angaben ändern, ohne den physischen Tag anzufassen – nur ein Formular, kein NFC-Kontakt nötig.
- **Erneut auf Tag schreiben**: Die gespeicherten Angaben auf einen physischen Tag übertragen – denselben oder einen anderen. Liest den Tag vorher kurz aus und zeigt vorhandenen Inhalt an, bevor überschrieben wird.
- **Aus der Liste entfernen**: Entfernt den Eintrag nur aus der App-Liste auf diesem Handy. Der physische Tag bleibt unverändert und löst beim Scannen weiterhin die bisherige Aktion aus. (Um einen Tag stattdessen neu zu belegen, einfach „Erneut auf Tag schreiben" mit einer anderen Konfiguration nutzen – Überschreiben reicht.)

## Tag-Infos anzeigen

Über den Button „Tag-Infos anzeigen" im Dashboard kannst du einen beliebigen physischen Tag scannen und siehst:

- die Seriennummer,
- die darauf gespeicherten Datensätze (Typ + Inhalt),
- die ungefähre Größe der gespeicherten Nachricht in Byte.

Wichtig: Web-NFC liefert nur diese Informationen – **nicht** den genauen Chip-Typ (z.B. NTAG213/215/216) und **nicht** die tatsächliche Speicherkapazität des Tags. Dafür wäre native NFC-Unterstützung nötig.

## Wichtig zu wissen

- Die Liste deiner Tags wird nur lokal auf **diesem** Handy gespeichert (kein Konto, keine Synchronisation zwischen Geräten).
- Beschreiben von Tags funktioniert nur auf Android mit Chrome/Edge/Samsung Internet. Öffnest du die App am PC oder auf dem iPhone, erscheint stattdessen ein Hinweis.
- Der Timer ist bewusst ein ehrlicher In-Page-Countdown, kein Trick über einen Android-Intent-Link – solche automatischen oder Klick-ausgelösten Weiterleitungen an die native Uhr-App hat Chrome in der Praxis zu inkonsistent behandelt (teils stillschweigend blockiert). Die Seite muss dafür offen bleiben, lässt sich aber jederzeit über „Timer abbrechen" sauber verlassen.

## Für Entwickler: lokal testen

```
npx serve .
```

oder ein beliebiger anderer statischer Webserver im Projektordner. NFC-Funktionen lassen sich nur auf einem echten Android-Handy testen (HTTPS erforderlich – z.B. über GitHub Pages oder einen Tunnel wie ngrok).

## Deployment auf GitHub Pages

1. Repo-Inhalt auf GitHub pushen.
2. Repo-Einstellungen → Pages → Branch auswählen, unter dem die Dateien liegen.
3. Die Seite ist danach unter `https://<username>.github.io/<repo>/` erreichbar.

## Phase 2 (optional): native Android-App

Für einen zuverlässigen, auch bei geschlossener App abbrechbaren Timer-Alarm siehe [PHASE2.md](PHASE2.md) – braucht ein lokal installiertes Android Studio/SDK und ist erst sinnvoll, wenn Phase 1 fertig getestet ist.
