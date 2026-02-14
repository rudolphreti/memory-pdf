# Memory PDF Projektmanager

Ein reines Frontend-Projekt auf Basis von Vite, React, TypeScript, MUI und Dexie (IndexedDB). Die Anwendung speichert Projekte und Bilder direkt im Browser.

Hinweis: Diese README ist bewusst als reine Textdatei ohne Assets angelegt.

## Funktionen

- Projektmodell: \`id\`, \`name\`, \`createdAt\`, \`note\`, \`layout (6|12)\`, \`images[]\`.
- Mehrfach-Upload von Bildern (JPG/PNG/WEBP) mit Vorschau-Grid und Entfernen.
- Sofortige Speicherung in IndexedDB (inklusive Bild-Blobs).
- Beim Start wird das zuletzt verwendete Projekt automatisch geladen.
- PDF-Export via pdf-lib z wyborem szablonu: A4 210×297mm (2×3, 99mm, pasek 12mm) lub A4 297×210mm (4×3, 70mm, pasek 17mm), 300 DPI Crop-Renderings.
- Layout: wybór między 6 kartami (2×3) oraz 12 kartami (4×3, A4 poziomo); inkl. Paare i Multi-Page.
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
