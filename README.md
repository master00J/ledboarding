# ArenaCue LED boarding

Aparte webapp voor perimeter/tribune LED-output: configureerbare **pixelcanvas per zone**, optioneel **vast LED-segment per zone**, sponsors met **logo**, **playlist per segment** (fallback naar live), **JSON export/import**, **sneltoetsen 1–9** op output, optionele **feed** (`VITE_ARENACUE_FEED_URL`) voor het globaal segment.

## Ontwikkeling

```bash
cd ledboarding
npm install
npm run dev              # alleen Vite (browser)
npm run electron:dev     # Vite production-build + Electron-venster (zelfde flow als scoreboard-dev)
```

- **Instellingen:** `http://localhost:5173/#/` (of in Electron na `electron:dev`: hash-routes)
- **Output:** `#/display/<zone-id>` — **F** voor fullscreen op het canvas.

### Installer (Windows, zelfde patroon als Stadium Scoreboard)

```bash
npm run build
```

Levert in **`dist/`** (zelfde als Stadium Scoreboard) o.a. portable **`ArenaCue-Ledboarding.exe`** en een **NSIS-setup**. Signing staat uit (`forceCodeSigning: false`).

**Icoon (zelfde bron als scoreboard):** vóór elke build draait `scripts/ensure-windows-icon.mjs` — zoekt een PNG (`ledboarding/public/arenacue-icon.png`, of `../Website/public/assets/arenacue-icon.png`, of `../public/app-icon.png`) en schrijft `build/icon.ico`; zo niet, kopieert het `../build/icon.ico` van een scoreboard-build.

### Alleen statische webbuild (geen Electron)

```bash
npm run renderer:build
```

Output staat in **`renderer-dist/`** (relatieve paden, geschikt voor `file://` of hosting).

Config blijft lokaal (`localStorage`).

## Repo

Deze map staat onder het scoreboard-project maar staat in **`.gitignore`** van de hoofdrepo zodat je hier een **eigen git-remote** kunt gebruiken, bv. `https://github.com/master00J/ledboarding`.

```bash
cd ledboarding
git init
git remote add origin https://github.com/master00J/ledboarding.git
git add -A
git commit -m "Initial LED boarding app"
git push -u origin master
```

(Branch `main` gebruiken als je die op GitHub als default hebt.)
