# ArenaCue LED boarding — gebruikershandleiding (simpel uitgelegd)

Deze tekst is bedoeld voor iedereen die **nog nooit** met het programma heeft gewerkt. Je hoeft geen programmeur te zijn.

---

## 1. Wat doet dit programma?

- Je maakt **virtuele “zones”** (bijv. “Perimeter links”, “Tribune boven”). Elke zone heeft een **breedte en hoogte in pixels**, zoals jouw echte LED-scherm of LED-controller verwacht.
- Je koppelt **sponsors** (tekst, logo, afbeelding of video) aan **playlists** binnen **segmenten** (bijv. “Live”, “Rust”, “Commercial”).
- Je opent een **outputvenster** per zone: dat is wat je op de projector, narrowcasting-pc of LED-input zet. Daar draait de **playlist** van het gekozen segment rond.

**Texture-export** is een aparte tool in dezelfde app: daar maak je van één sponsorbestand **één PNG** in exacte afmetingen voor hardware die **geen** live webpagina wil, maar wél een statisch bestand.

---

## 2. Twee manieren om het programma te openen

| Manier | Wanneer gebruiken? |
|--------|-------------------|
| **Windows-app** (`ArenaCue-Ledboarding.exe` na install of portable) | Volledige functie: texture-export, meerdere outputvensters, bestandskiezers. **Aanbevolen op de regie-pc.** |
| **Alleen browser** (`npm run dev`, daarna bv. `http://localhost:5173`) | Snel kijken of testen. Geen texture-export; output opent als **normaal browsertabblad**. |

Als je ergens **“Alleen in desktop-app”** ziet: die knop werkt pas als je de **echte .exe** start, niet de kale browser.

---

## 3. Wat je bovenaan ziet (tabs)

Na het openen van het **control panel** (startscherm met donkere stijl) zie je tabs:

| Tab | Kort wat je daar doet |
|-----|------------------------|
| **Dashboard** | Welk **globaal segment** is actief + knoppen om **outputvensters** te openen, focussen of sluiten. |
| **Zones & output** | Zones aanmaken, **pixels** instellen, optioneel **vast segment** per zone, **subzones**. |
| **Texture-export** | Sponsorbanner → **PNG** voor LED-controller (alleen desktop-app). |
| **Content** | Sponsors en segmenten beheren (logo’s, tekst, media). |
| **Playlists** | Welke sponsors in welk segment, **scroll** of **hold**, tijden. |
| **Backup** | Alles **exporteren** naar een JSON-bestand of **terugzetten**. |

Tip: werk meestal in deze volgorde als je nieuw bent: **Content** → **Playlists** → **Zones** → **Dashboard** (output openen).

---

## 4. Minimaal stappenplan: “Ik wil sponsors op mijn LED zien”

### Stap A — Sponsors klaarzetten (tab **Content**)

1. Open de tab **Content**.
2. Voeg per sponsor toe wat je wilt tonen (naam, kleuren, logo, eventueel afbeelding/video).
3. Controleer dat er minstens één **segment** bestaat (standaard staat er al bv. “Live”). Zo niet: segment aanmaken en een **label** geven dat je herkent.

### Stap B — Playlist vullen (tab **Playlists**)

1. Open **Playlists**.
2. Kies een **segment** (bv. Live).
3. Zet sponsors in de lijst en stel **duur** of scroll-gedrag in (afhankelijk van scroll/hold-modus in de instellingen van dat segment).
4. Herhaal voor andere segmenten als je die gebruikt.

### Stap C — Zone aanmaken (tab **Zones & output**)

1. Open **Zones & output**.
2. Klik **Zone toevoegen** als je nog geen zone hebt.
3. Vul **Naam** in (alleen voor jezelf, bv. “Ring volledig”).
4. Vul **Breedte** en **Hoogte** in **pixels** exact zoals jouw LED-systeem verwacht (bv. 1920 × 256). **Fout = vervormd of afgesneden beeld.**
5. Onder **LED-segment (zone)**:
   - Laat op **“Volgt globaal actief segment”** staan als deze zone altijd moet meewisselen met wat je op het **Dashboard** kiest.
   - Kies een **vast segment** alleen als deze zone **onafhankelijk** moet blijven (bv. tribune blijft “Commercial” terwijl het veld “Live” toont).

### Stap D — Output openen (tab **Dashboard** of **Zones**)

**Met de Windows-app (aanbevolen):**

1. Ga naar **Dashboard**.
2. Kies bovenaan **Globaal actief segment** (welke playlist de zones volgen die “globaal” zijn).
3. Bij jouw zone: klik **Output openen**. Er opent een **nieuw venster** met zwarte achtergrond en jouw LED-layout.
4. Zet dat venster op de juiste monitor op **fullscreen** (knop **Fullscreen (F)** of toets **F**).

**Zonder desktop-app (browser):**

- Klik in **Zones** op **Output openen** (link): er opent een tabblad met `#/display/...` in de adresbalk.

### Stap E — Tijdens de show

- Op het **outputvenster**: onderaan kun je het segment nog wijzigen (als de zone niet “vast” staat).
- **Toetsen 1 t/m 9**: spring snel naar segment 1–9 uit de sneltoetsenlijst (zie kleine tekst onderaan het outputvenster). Werkt **niet** als je cursor in een tekstveld staat.

---

## 5. Dashboard in detail

- **Globaal actief segment**: één keuze voor **alle zones die “globaal” volgen**. Handig als je met één schakelaar van “live” naar “rust-commercial” wilt.
- **Outputs**: per zone zie je of het venster **Open** of **Gesloten** is.
  - **Output openen** — opent of heropent het venster.
  - **Focus** — brengt het venster naar voren (alleen desktop-app).
  - **Sluiten** — sluit het venster (alleen desktop-app).

---

## 6. Zones & output — subzones (optioneel)

**Subzones** zijn kleine rechthoeken **binnen** één zone (bijv. hoek A, hoek B, middenstuk). Elk stukje kan een **eigen segment** hebben.

- Begin **zonder** subzones: één zone = één volledig canvas = het simpelst.
- Voeg subzones toe als jouw fysieke LED uit **meerdere onafhankelijke vensters** op één controller bestaat.

---

## 7. Texture-export (alleen desktop-app)

Gebruik dit als jouw hardware een **vaste PNG** nodig heeft (exacte pixelbreedte/hoogte), niet een live webpagina.

### Kort stappenplan

1. Tab **Texture-export**.
2. **Kies afbeelding…** (of video; dan wordt het **eerste frame** gebruikt).
3. Stel **strip** in = resolutie van **één horizontale strook** op de LED (bv. 1920 × 72).
4. Stel **outputcanvas** in = totale textuur die de controller in één keer inlaadt (bv. 1920 × 990).
5. Kies **Vullen (cover)** of **Passend (contain)** en **Onder elkaar** of **Diagonaal verschoven**.
6. **Outputmap kiezen**: vaste map op schijf (bv. waar de controller bestanden leest).
7. Pas eventueel het **bestandsnaam-sjabloon** aan (tokens staan onder het veld).
8. **Voorbeeld** laat zien wat je krijgt.
9. Export:
   - **Snel opslaan in outputmap** — zonder dialoog, direct wegschrijven.
   - **Batch exporteren…** — meerdere bestanden tegelijk met dezelfde strip/canvas-instellingen.
   - **Opslaan als…** — klassieke Windows “opslaan”-dialoog.

**Map openen** opent de gekozen outputmap in Verkenner.

---

## 8. Backup (tab **Backup**)

- **Exporteren**: sla alle zones, content en playlists op in één **JSON**-bestand. Doe dit voor je grote wijzigingen of voor je pc vervangt.
- **Importeren**: zet een eerder exportbestand terug (overschrijft huidige configuratie in de browser op die machine).

---

## 9. Waar worden mijn gegevens bewaard?

- In de **browser / Electron** worden instellingen lokaal opgeslagen (**localStorage** op die computer).
- Een andere pc heeft **niet automatisch** dezelfde sponsors: gebruik **Backup** om te kopiëren.

---

## 10. Problemen en oplossingen

| Probleem | Wat te doen |
|----------|-------------|
| Texture-knoppen werken niet | Start de **.exe**, niet alleen de website. |
| Beeld vervormd of afgesneden | Controleer **Breedte × Hoogte** van de zone tegen de specificatie van de LED. |
| Verkeerde sponsors | Check **Playlists** per segment en of de zone **globaal** of een **vast segment** volgt. |
| Toetsen 1–9 doen niets | Klik eerst in het outputvenster (niet in een tekstveld); geen Ctrl/Alt vasthouden. |
| Fullscreen lukt niet | Probeer **F11** (browser) of controleer of de site fullscreen mag. |
| “Zone niet gevonden” | De **zone-id** in de URL hoort bij een bestaande zone; ga terug naar **Instellingen** en open output opnieuw via de knop. |

---

## 11. Optionele koppeling met ArenaCue (feed)

Als in de build een **`VITE_ARENACUE_FEED_URL`** is ingesteld, kan de app het actieve segment laten **volgen** via een externe feed. Dat is bedoeld voor gekoppelde wedstrijd-/arena-setup. Vraag je beheerder of dit bij jullie aan staat; anders hoef je hier niets mee te doen.

---

*Versie van deze handleiding sluit aan bij de LED-boarding-app in deze repository. Bij twijfel over hardware: raadpleeg de handleiding van jouw LED-controller.*
