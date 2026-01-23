# Memory PDF Projektmanager

Ein reines Frontend-Projekt auf Basis von Vite, React, TypeScript, MUI und Dexie (IndexedDB). Die Anwendung speichert Projekte und Bilder direkt im Browser.

Hinweis: Diese README ist bewusst als reine Textdatei ohne Assets angelegt.

## Funktionen

- Projektmodell: \`id\`, \`name\`, \`createdAt\`, \`note\`, \`layout (6)\`, \`images[]\`.
- Mehrfach-Upload von Bildern (JPG/PNG/WEBP) mit Vorschau-Grid und Entfernen.
- Sofortige Speicherung in IndexedDB (inklusive Bild-Blobs).
- Beim Start wird das zuletzt verwendete Projekt automatisch geladen.
- PDF-Export via pdf-lib (A4 210×297mm, 6×99mm Karten, 12mm Streifen, 300 DPI Crop-Renderings).
- Layout: 6 Karten als 2x3 Raster ohne Ränder, inkl. Paare und Multi-Page; Schnittlinien bei 99mm/198mm (vertikal) und 99mm (horizontal).
- Projekt-Export/Import als JSON inkl. Base64-Bildern mit Wiederherstellung in IndexedDB.

## Entwicklung

\`\`\`bash
npm install
npm run dev
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\`
