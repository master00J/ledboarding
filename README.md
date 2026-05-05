# ArenaCue LED boarding

Aparte webapp voor perimeter/tribune LED-output: configureerbare **pixelcanvas per zone**, optioneel **vast LED-segment per zone**, sponsors met **logo**, **playlist per segment** (fallback naar live), **JSON export/import**, **sneltoetsen 1–9** op output, optionele **feed** (`VITE_ARENACUE_FEED_URL`) voor het globaal segment.

## Ontwikkeling

```bash
cd ledboarding
npm install
npm run dev
```

- **Instellingen:** [http://localhost:5173/](http://localhost:5173/)
- **Output:** open “Output openen” bij een zone, of `/display/<zone-id>` — **F** voor fullscreen (alleen het canvas-gebied).

Config wordt lokaal bewaard (`localStorage`). Productie-build: `npm run build` → map `dist/` (statisch hosten of kiosk-browser).

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
