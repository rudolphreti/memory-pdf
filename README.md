# Memory PDF Projektmanager

Ein reines Frontend-Projekt auf Basis von Vite, React, TypeScript, MUI und Dexie (IndexedDB). Die Anwendung speichert Projekte und Bilder direkt im Browser.

Hinweis: Diese README ist bewusst als reine Textdatei ohne Assets angelegt.

## Funktionen

- Projektmodell: \`id\`, \`name\`, \`createdAt\`, \`note\`, \`layout (4|6|8)\`, \`images[]\`.
- Mehrfach-Upload von Bildern (JPG/PNG/WEBP) mit Vorschau-Grid und Entfernen.
- Sofortige Speicherung in IndexedDB (inklusive Bild-Blobs).
- Beim Start wird das zuletzt verwendete Projekt automatisch geladen.
- PDF-Export via pdf-lib (A4 Hochformat, 10mm Ränder, 4mm Gutter, 300 DPI Crop-Renderings).
- Layouts: 4=2x2, 6=2x3, 8=2x4 inkl. doppelte Karten (Paare) und Multi-Page.
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
