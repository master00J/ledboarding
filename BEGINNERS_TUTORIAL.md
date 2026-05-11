# Beginnershandleiding ArenaCue LED Boarding

Deze handleiding legt stap voor stap uit hoe je de LED boarding-app instelt voor testen op de pc en later voor gebruik met echte LED-processors.

## 1. Basisidee

De app stuurt geen UTP rechtstreeks naar de LED boarding. De app maakt beeld op een Windows-scherm. Dat scherm gaat via HDMI of DisplayPort naar een LED-processor. De processor stuurt daarna via UTP naar de LED-panelen.

De keten is dus:

```text
ArenaCue LED Boarding app -> HDMI/DisplayPort -> LED-processor -> UTP -> LED boarding
```

Belangrijk:

- 1 LED-processor is meestal 1 Windows-scherm.
- 1 perimeter of scherm in de app heet een zone.
- Een zone krijgt een resolutie, bijvoorbeeld `1920 x 72`.
- Video's worden gewoon afgespeeld en scrollen niet.
- Tekst/logo-items kunnen wel scrollen als je dat zo instelt.

## 2. App Starten

Open deze file:

```text
ledboarding\dist\ArenaCue-Ledboarding.exe
```

Als Windows vraagt of je de app vertrouwt, kies dan uitvoeren. De app is momenteel nog niet gesigneerd en gebruikt nog het standaard Electron-icoon.

## 3. Testen Zonder Echte LED Boarding

Je kunt alles testen op de pc zonder LED-hardware.

1. Start `ArenaCue-Ledboarding.exe`.
2. Ga naar `Zones & output`.
3. Klik op `Laad volledige testopstelling`.
4. Bevestig dat bestaande testdata vervangen mag worden.
5. Ga naar `Live Console`.
6. Klik op `Start alle` of open één output apart.
7. Gebruik `Testbeeld`, `Blackout`, `Play`, `Pauze`, `Vorige` en `Volgende`.

De testopstelling gebruikt de video's uit:

```text
ledboarding\visuals ledboarding
```

De preset maakt onder andere:

- `Pitch perimeter` met hoogte `72px`
- `Luifel perimeter` met hoogte `72px`
- `T4 scherm main`
- `T4 scherm backup`

## 4. Windows-Schermen Instellen

Voor echte processors:

1. Sluit elke LED-processor met HDMI of DisplayPort aan op de pc.
2. Open Windows beeldscherminstellingen.
3. Kies `Deze beeldschermen uitbreiden`.
4. Zet schaal op `100%`.
5. Zet slaapstand en schermbeveiliging uit.
6. Noteer welk Windows-scherm naar welke processor gaat.

Voorbeeld:

```text
Scherm 1 -> Bedienmonitor
Scherm 2 -> LED PITCH processor
Scherm 3 -> LED LUIFEL processor
Scherm 4 -> T4 SCHERM processor
```

## 5. Zones Instellen

Ga in de app naar `Zones & output`.

Maak per fysieke LED-output een zone.

Voor een perimeter van 72 pixels hoog:

```text
Naam: Pitch perimeter
Breedte: 1920
Hoogte: 72
Processor / uitgang: LED PITCH processor
Windows-scherm / processor input: kies het scherm dat via HDMI naar die processor gaat
```

Gebruik de echte resolutie die de processor verwacht. Als de processor bijvoorbeeld `3840 x 72` verwacht, vul je dat in.

Klik daarna op `Electron output` of open de output via de `Live Console`. De app zet het outputvenster fullscreen op het gekoppelde Windows-scherm.

## 6. Content Toevoegen

Ga naar `Content`.

Per sponsor of visual maak je een item aan.

Voor video:

1. Klik `Sponsor toevoegen`.
2. Geef een duidelijke naam, bijvoorbeeld `Coca-Cola Pitch`.
3. Kies bij `LED content` voor video.
4. Klik `Media kiezen...`.
5. Selecteer de video.
6. Zet `Vullen/croppen` als de video het volledige lint moet vullen.

Belangrijk:

- Video's scrollen niet.
- Video's worden fullscreen binnen de zone afgespeeld.
- Zorg dat de video dezelfde verhouding heeft als de LED-zone, bijvoorbeeld heel breed en `72px` hoog.

## 7. Playlists En Segmenten

Ga naar `Playlists`.

Een segment is een playlist voor een bepaald moment in de wedstrijd.

Voorbeelden:

- `Voor match`
- `Eerste helft`
- `Rust`
- `Tweede helft`
- `Na goal`
- `Einde match`

Per segment stel je in welke sponsors of video's getoond worden en hoe lang.

Voorbeeld:

```text
Coca-Cola Pitch: 15 seconden
Circus Daily: 15 seconden
Foot Challenge: 15 seconden
```

Als je een segment aan een zone koppelt, toont die zone altijd dat segment. Als een zone geen vast segment heeft, volgt die het globale actieve segment uit de Live Console.

## 8. Match Planning

Ga naar `Match Planning`.

Hier kun je vooraf instellen welk segment op welk moment moet draaien.

Voorbeeld:

```text
Pre-match: minuut -30 tot 0 -> Voor match
Eerste helft: minuut 0 tot 45 -> Eerste helft
Rust: minuut 45 tot 60 -> Rust
Tweede helft: minuut 60 tot 105 -> Tweede helft
Post-match: minuut 105 tot 120 -> Einde match
```

Zet `Live Console volgt deze matchplanning automatisch` aan als de app automatisch moet schakelen.

Gebruik:

1. Stel alle tijdblokken in.
2. Kies per tijdblok het juiste segment.
3. Klik `Start planning`.
4. Ga naar `Live Console`.
5. Controleer dat de planningstatus zichtbaar is.

De app toont ook geplande sponsor-exposure. Dat is een schatting van hoeveel tijd elke sponsor volgens de planning in beeld komt.

## 9. Live Console Gebruiken

De `Live Console` is het bedienpaneel tijdens de match.

Hier kun je:

- Outputs openen.
- Alle gekoppelde zones starten.
- Segmenten handmatig starten.
- Play en pauze gebruiken.
- Naar vorige of volgende sponsor gaan.
- Blackout activeren.
- Testbeeld tonen.
- Zien welke outputs open zijn.
- Zien welke processor of welk scherm bij een zone hoort.

Gebruik `Blackout` alleen bewust. Dit zet de output zwart.

Gebruik `Testbeeld` om te controleren of de juiste processor en LED-locatie beeld krijgen.

## 10. Subzones Gebruiken

Subzones gebruik je alleen als één processorbeeld meerdere vaste plekken bevat.

Voorbeeld:

Een processor verwacht één canvas van `1920 x 216`, maar dat bestaat uit drie LED-stroken van `1920 x 72`.

Dan maak je één zone:

```text
Zone: LED processor 1
Breedte: 1920
Hoogte: 216
```

Daarbinnen maak je subzones:

```text
Subzone 1: X 0, Y 0, Breedte 1920, Hoogte 72
Subzone 2: X 0, Y 72, Breedte 1920, Hoogte 72
Subzone 3: X 0, Y 144, Breedte 1920, Hoogte 72
```

Elke subzone kan een eigen segment volgen.

Voor simpel gebruik is dit niet nodig. Gebruik dan gewoon `1 processor = 1 zone`.

## 11. Aanbevolen Workflow Voor Een Match

Voor de match:

1. Sluit alle processors aan.
2. Controleer Windows-schermen.
3. Open de app.
4. Controleer alle zones en processor-koppelingen.
5. Open outputs.
6. Toon testbeeld.
7. Controleer fysiek of elke LED-locatie klopt.
8. Zet testbeeld uit.
9. Controleer playlists en matchplanning.
10. Start de planning of start het juiste segment handmatig.

Tijdens de match:

1. Bedien vanuit `Live Console`.
2. Gebruik handmatige segmentknoppen voor overrides.
3. Gebruik `Blackout` alleen indien nodig.
4. Gebruik `Pauze` als beeld even moet blijven staan.

Na de match:

1. Stop of reset de planning.
2. Sluit outputs.
3. Exporteer eventueel de configuratie via `Backup`.

## 12. Veelgemaakte Fouten

Als de output op het verkeerde scherm staat:

- Controleer de zone bij `Windows-scherm / processor input`.
- Controleer Windows beeldscherminstellingen.
- Gebruik `Testbeeld` om te identificeren welk scherm welke processor is.

Als de video te hoog of te laag lijkt:

- Controleer de zonehoogte.
- Voor jullie perimeter is dat meestal `72px`.
- Controleer of de video zelf ook gemaakt is voor die verhouding.

Als tekst op de output verschijnt die niet in de video hoort:

- Controleer of het sponsoritem als video/afbeelding staat.
- De app zet geen overlay meer bovenop video/media.

Als een sponsor niet verschijnt:

- Controleer of de sponsor in de juiste playlist staat.
- Controleer of het actieve segment klopt.
- Controleer of de zone niet vast op een ander segment staat.

Als de matchplanning niet schakelt:

- Controleer of planning `Aan` staat.
- Controleer of de planning gestart is.
- Controleer of de Live Console open is.
- Controleer of elk tijdblok een geldig segment heeft.

## 13. Belangrijk Voor Echte LED

Brightness regel je bij voorkeur op de LED-controller, niet in de app.

De app levert content en timing. De processor regelt de echte LED-output naar de panelen.

Voor live gebruik altijd eerst testen met:

- testbeeld
- blackout
- elke zone apart
- alle zones tegelijk
- video playback
- matchplanning
