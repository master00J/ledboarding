# ArenaCue LED boarding

Aparte webapp voor perimeter/tribune LED-output: configureerbare **pixelcanvas per zone**, optioneel **vast LED-segment per zone**, sponsors met **logo**, **playlist per segment** (fallback naar live), **JSON export/import**, **sneltoetsen 1–9** op output, optionele **feed** (`VITE_ARENACUE_FEED_URL`) voor het globaal segment, en in de **desktop-app** een tab **Texture-export** (PNG voor LED-controllers via **sharp** + **ffmpeg-static**).

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

## Texture-export (desktop) voor LED-controllers

In het control panel: tab **Texture-export** (alleen in de **Electron**-app, niet in de kale browser). Daarmee:

1. Kies een **bronafbeelding** (PNG, JPEG, WebP, …) of **video** (MP4, WebM, MOV, …): voor video wordt het **eerste frame** (t ≈ 0) met **FFmpeg** naar een tijdelijke PNG geëxporteerd, daarna dezelfde pijplijn als bij een foto.
2. Stel **strip** in (exacte pixels op de lint, bv. `1920×72`) en **cover** (vullen) of **contain** (passend + zwarte rand).
3. Stel **outputcanvas** in (bv. `1920×990`) en kies **onder elkaar** of **diagonaal verschoven** (shift per rij).
4. **Voorbeeld** (live) en **Exporteren als PNG** via save-dialog; de map van je laatste export wordt onthouden.

Techniek: **ffmpeg-static** (eerste videoframe) en **sharp** (`electron/texture-export.ts`, `electron/video-frame.ts`) in het Electron-mainproces.

Zie ter referentie: [mastery.com/ledboard](https://mastery.com/ledboard/) onder *Stadion*.

### Nog mogelijke uitbreidingen

| Onderwerp | Idee |
|-----------|------|
| **Video** | Tijdstip kiezen (niet alleen eerste frame), of korte clip naar frame-atlas |
| **PNG-reeks / automatische map** | Batch export naar vaste map zonder dialoog |
| **Koppeling live-app** | Genormaliseerde strip direct als sponsor-`mediaSrc` kiezen |
