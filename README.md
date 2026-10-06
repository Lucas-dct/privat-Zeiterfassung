# Zeiterfassung

Kleine Zeiterfassungs-App fürs Handy (PWA, ohne Server, ohne App-Store). Deutsch.

- **Start/Ende mit Timer**
- **Pausen** werden automatisch abgezogen: bis 6 h keine, über 6 h bis 9 h 30 min, über 9 h 45 min
- **Wochenplaner**: Wochenstunden (z. B. 35 h), einzelne Tage fest setzen (z. B. Freitag 5 h), Rest wird automatisch auf die übrigen Tage verteilt
- Daten liegen **nur lokal auf dem Gerät** (localStorage); CSV-Export und JSON-Backup in den Einstellungen

## Nutzen
Per GitHub Pages veröffentlichen (Settings → Pages → Source: „GitHub Actions“), dann die URL auf dem Handy öffnen und
„Zum Home-Bildschirm hinzufügen“ wählen (Android: Chrome-Menü, iPhone: Safari → Teilen).

Lokal testen: `python3 -m http.server` und `node test.js` für die Berechnungslogik.
