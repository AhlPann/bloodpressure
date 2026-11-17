# Blutdruck-Tagebuch

Installierbare Web-App (PWA) zum Erfassen und Auswerten von Blutdruckwerten am Handy.
Alle Daten bleiben lokal im Browser-Speicher (IndexedDB) des Geräts, es gibt keinen Server und kein Konto.

## Funktionen

- **Erfassen**: bis zu 3 Messungen pro Sitzung mit automatischem Mittelwert, Arm, Besonderheiten und Notiz.
  Die Medikamenteneinnahme (Standard: Candecor 8 mg) lässt sich mit einem Tipp vermerken.
- **Verlauf**: alle Messungen und Einnahmen nach Tag gruppiert, zum Bearbeiten antippen.
- **Auswertung**: Diagramm, Durchschnitt mit Einstufung nach ESH 2023, morgens/abends und Bezug zur Einnahme
  (6-Stunden-Fenster, Tage mit/ohne Einnahme).
- **Bericht**: druckfertiges Protokoll für den Arzt (in Chrome: Drucken → „Als PDF speichern“).
- **Datensicherung**: Backup als JSON (Export/Import), CSV für Excel und Teilen, z. B. in Google Drive.

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5173/bloodpressure/
npm test         # Unit-Tests (Vitest)
npm run build    # Produktions-Build nach dist/
npm run icons    # App-Icons in public/icons/ neu erzeugen
```

## Veröffentlichung (GitHub Pages)

1. Auf GitHub ein Repository `bloodpressure` anlegen und dieses Projekt dorthin pushen.
2. Im Repository unter **Settings → Pages → Build and deployment** als Quelle **GitHub Actions** wählen.
3. Jeder Push auf `main` führt Tests und Build aus und veröffentlicht die App unter
   `https://<benutzername>.github.io/bloodpressure/`.

Heißt das Repository anders, muss `BASE` in `vite.config.ts` angepasst werden.

## Auf dem Android-Handy installieren

1. Die Pages-Adresse in Chrome öffnen.
2. Menü (⋮) → **App installieren** bzw. **Zum Startbildschirm hinzufügen**.
3. Die App startet danach wie eine normale App und funktioniert auch offline.

**Wichtig:** Wer die App deinstalliert oder die Website-Daten in Chrome löscht, löscht damit auch die Messwerte.
Deshalb regelmäßig unter *Mehr → Backup herunterladen/teilen* sichern; die App erinnert nach 30 Tagen daran.

> Keine medizinische Beratung. Werte und Medikation bitte mit dem Arzt besprechen.
