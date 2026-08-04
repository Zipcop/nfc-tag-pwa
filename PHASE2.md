# Phase 2 (später, optional): Umwandlung in eine native Android-App mit Capacitor

**Nur starten, wenn Phase 1 fertig getestet ist UND ein Rechner mit installiertem Android Studio + Android SDK zur Verfügung steht.**

**Status:** Phase 2 ist inzwischen **empfohlen statt rein optional**, wenn ein zuverlässiger UND abbrechbarer Timer gewünscht ist. Phase 1 (PWA) hat sich als strukturell unfähig erwiesen, einen nativen Android-Alarm zuverlässig auszulösen (weder automatisch noch per Klick auf einen `intent://`-Link – Chrome blockiert das zu inkonsistent) und bietet deshalb bewusst nur einen ehrlichen In-Page-Countdown mit Abbrechen-Button an. Ein Alarm, der auch bei geschlossener App zuverlässig auslöst, braucht die native Capacitor-Version.

## Grundprinzip

Capacitor übernimmt den kompletten HTML/CSS/JS-Code aus Phase 1 praktisch unverändert und packt ihn in eine native Android-App. Über eine JavaScript-Brücke bekommt der Code zusätzlich Zugriff auf native Funktionen (echte System-Alarme, natives NFC).

## Setup-Schritte

1. `npm install @capacitor/core @capacitor/cli`
2. `npx cap init` (App-Name, Package-ID, z.B. `com.<kollegin>.nfcapp`)
3. Bestehende Web-Dateien aus Phase 1 unverändert in den `www/`-Ordner übernehmen
4. `npx cap add android` → generiert das native Android-Studio-Projekt
5. Plugins installieren:
   - `@capacitor/local-notifications` (für den zuverlässigen Timer)
   - Ein **frei nutzbares** NFC-Community-Plugin, z.B. `@capgo/capacitor-nfc` oder `Exxili/capacitor-nfc` (nicht das Capawesome-Plugin verwenden – das läuft aktuell nach einem kostenpflichtigen Sponsorware-Modell)
6. `npx cap sync`
7. Build über Android Studio GUI oder headless via `./gradlew assembleRelease` (braucht einmalig einen Signierschlüssel/Keystore)

## Zuverlässiger Hintergrund-Timer

- Alarme über `LocalNotifications.schedule()` planen (nutzt intern Androids AlarmManager).
- In `AndroidManifest.xml` die Berechtigung `SCHEDULE_EXACT_ALARM` ergänzen (ab Android 12 nötig für exakte Alarmzeiten).
- Option `allowWhileIdle: true` setzen, damit der Alarm auch im Doze-Stromsparmodus feuert (maximal alle 9 Minuten pro App, das reicht für unseren Anwendungsfall).
- Beim App-Start per `checkExactNotificationSetting()` prüfen, ob exakte Alarme noch erlaubt sind, und die Nutzerin andernfalls im UI freundlich darauf hinweisen.
- **Wichtiger Hinweis, der in die README/Anleitung für die Nutzerin muss:** Auf Samsung-Handys (One UI) muss die App einmalig manuell von der Akku-Optimierung ausgenommen werden (Einstellungen → Akku → „Nie schlafende Apps" bzw. „nicht optimieren"). Sonst kann Samsungs eigene Akku-Verwaltung selbst einen nativen Alarm irgendwann unterdrücken.

### Ergänzung: abbrechbare, im Dashboard sichtbare Timer

- Beim Stellen eines Timers die von `LocalNotifications.schedule()` zurückgegebene Notification-ID zusammen mit Label und Ziel-Zeitpunkt (Datum/Uhrzeit, zu dem der Alarm feuert) in `localStorage` speichern – separat von der Tag-Konfigurationsliste, da ein laufender Timer ein transienter Zustand ist, keine dauerhafte Einstellung.
- Im Dashboard einen Bereich „Laufende Timer" einblenden, der alle aktiven Timer mit Restzeit anzeigt (nur sichtbar, wenn mindestens einer läuft).
- Pro laufendem Timer einen Button „Abbrechen":
  1. `LocalNotifications.cancel({ notifications: [{ id }] })` aufrufen, um den geplanten nativen Alarm zu löschen.
  2. Danach den zugehörigen `localStorage`-Eintrag aus der Liste der laufenden Timer entfernen.
- Nach Ablauf eines Timers (Notification wurde zugestellt) den `localStorage`-Eintrag ebenfalls automatisch entfernen (z.B. beim nächsten App-Start per Abgleich Ziel-Zeitpunkt < jetzt).

## Natives NFC

- Gewähltes Plugin für Lesen/Schreiben nutzen, Logik analog zur bisherigen Web-NFC-Funktion aus Phase 1.
- In `AndroidManifest.xml`: `<uses-permission android:name="android.permission.NFC" />` sowie `<uses-feature android:name="android.hardware.nfc" android:required="false" />` (auf `false`, damit die App theoretisch auch ohne NFC-Hardware installierbar bleibt).

## Push-Benachrichtigungen (ersetzt Web Push aus Phase 1)

Phase 1 nutzt Web Push über den separaten [nfc-push-worker](../nfc-push-worker) (Cloudflare Worker, `@block65/webcrypto-web-push`). In der nativen Capacitor-App wird das durch echtes FCM ersetzt:

- Plugin: `@capacitor/push-notifications` (Android, nutzt intern Firebase Cloud Messaging).
- **Kein neues Firebase-Projekt anlegen.** Stattdessen die NFC-App als zusätzliche Android-App im bereits bestehenden Firebase-Projekt der Wetter-App registrieren:
  - eigene Package-ID für die NFC-App im bestehenden Projekt anlegen,
  - die dafür generierte `google-services.json` in `android/app/` ablegen,
  - denselben Service-Account-Schlüssel des bestehenden Projekts für den Worker weiterverwenden (kein zweiter Schlüssel nötig).
- Beim App-Start `PushNotifications.register()` aufrufen und das resultierende FCM-Token an den bestehenden Worker-Endpunkt `/subscribe` schicken - gleiche Struktur wie beim Web-Push-Ansatz aus Phase 1 (dort wird die `PushSubscription` gespeichert, hier einfach das Token anstelle davon; die KV-Speicherung im Worker bleibt unverändert).
- Im Worker: `/notify` so anpassen, dass er bei einem gespeicherten FCM-Token statt `buildPushPayload()`/Web Push die Firebase-Admin-API (HTTP v1, mit dem Service-Account-Schlüssel signiert) aufruft, um die Nachricht zuzustellen. Die Unterscheidung Web-Push-Subscription vs. FCM-Token kann z.B. an der Form des gespeicherten Objekts festgemacht werden (`endpoint`+`keys` vs. reiner Token-String).

## App Links (damit das eigene Handy Tags direkt in der App öffnet)

- NFC-Tags weiterhin mit einer stinknormalen `https://`-URL beschreiben, genau wie in Phase 1 – wichtig, damit fremde Handys (z.B. beim Schlüsselanhänger-Szenario) den Tag weiterhin ganz normal im Browser öffnen können, auch ohne die App installiert zu haben.
- Eine `assetlinks.json`-Datei erstellen und unter `https://<username>.github.io/.well-known/assetlinks.json` hosten (verknüpft die Domain kryptografisch mit App-Package-ID und Signierschlüssel).
- In `AndroidManifest.xml` einen `intent-filter` mit `android:autoVerify="true"` für die GitHub-Pages-Domain ergänzen.
- Ergebnis: Scannt die Besitzerin selbst den Tag, öffnet sich direkt die App (mit Zugriff auf native Alarme). Scannt jemand anderes ohne die App, öffnet sich ganz normal die bestehende Webseite im Browser – keine Regression gegenüber Phase 1.

## Phase 2 – bewusst nicht im Scope

- Keine iOS-Version (Capacitor unterstützt das zwar grundsätzlich, ist hier aber nicht Teil des Auftrags).
- Keine Play-Store-Veröffentlichung – nur ein lokal signiertes APK zum Sideloaden.

## Qualitätssicherung Phase 2

- Testen: Timer stellen, App vollständig aus der Übersicht schließen, warten – prüfen, ob der Alarm trotzdem kommt.
- Testen: Timer stellen, im Dashboard „Laufende Timer" öffnen, „Abbrechen" tippen – prüfen, dass der Alarm wirklich nicht mehr kommt und der Eintrag aus der Liste verschwindet.
- Testen: Tag mit dem eigenen Handy (mit installierter App) scannen → sollte die App öffnen, nicht den Browser.
- Testen: Tag mit einem Handy ohne installierte App scannen → sollte weiterhin ganz normal im Browser öffnen.
- README um den Akku-Optimierungs-Hinweis sowie eine kurze Beschreibung des Build-Vorgangs (Android Studio nötig) ergänzen.
