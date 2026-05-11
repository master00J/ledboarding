export type LedRegion = {
  id: string;
  name: string;
  /** Linkerbovenhoek binnen de zone, in pixels. */
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  /** Vast segment voor deze subzone. Null = volgt zone/globaal. */
  segmentId?: string | null;
};

export type LedZone = {
  id: string;
  name: string;
  /** Pixelbreedte zoals de LED-controller / uitgang verwacht */
  widthPx: number;
  /** Pixelhoogte zoals de LED-controller / uitgang verwacht */
  heightPx: number;
  /**
   * Vast segment voor deze zone (t.o.v. tribune vs veld). Null = volgt het globaal actieve segment.
   */
  segmentId?: string | null;
  /** Naam/label van de fysieke LED-processor of uitgang in de rack-opstelling. */
  processorName?: string | null;
  /** Electron/Windows display-id waarop deze zone fullscreen geopend moet worden. */
  outputDisplayId?: number | null;
  /** Optionele vaste plekken binnen dit output-canvas. Leeg = volledige zone toont één playlist. */
  regions?: LedRegion[];
};

/** Doorlopende crawl langs alle playlist-items, of elk item als vast segment. */
export type PlaybackMode = "scroll" | "hold";

export type SponsorContentKind = "text" | "image" | "video";

export type MediaFit = "contain" | "cover";

export type ContentSettings = {
  playbackMode: PlaybackMode;
  /** Scroll-modus: tijd voor één volledige passage over alle playlist-items (één “ronde”). */
  scrollLoopDurationSec: number;
  /** Outputhelderheid in procenten. Wordt als CSS-brightness op het LED-canvas toegepast. */
  brightnessPercent: number;
  /** Fade-in duur tussen hold/video items. 0 = direct schakelen. */
  fadeTransitionMs: number;
  /**
   * Als true: poll `VITE_ARENACUE_FEED_URL` en pas het actieve LED-segment toe wanneer de feed een ander segment-id meldt.
   */
  feedFollowSegment?: boolean;
};

export type Sponsor = {
  id: string;
  /** Tekst op de boarding */
  label: string;
  /** Achtergrondkleur (#rrggbb) of leeg voor standaard */
  bgColor: string | null;
  /** Tekstkleur (#rrggbb) of leeg voor wit */
  textColor: string | null;
  /** Optioneel logo (meestal data-URL van geüploade afbeelding) */
  logoDataUrl: string | null;
  /** Wat dit item op de LED boarding toont. Oudere exports zonder waarde blijven tekst/logo. */
  contentKind: SponsorContentKind;
  /** Data-URL of lokaal bestandspad voor image/video content. */
  mediaSrc: string | null;
  /** Leesbare bestandsnaam voor beheer in het control panel. */
  mediaTitle: string | null;
  /** Hoe image/video in het LED-canvas past. */
  mediaFit: MediaFit;
  /** Gewenste schermtijd per wedstrijd in minuten. 0 = geen budgettracking. */
  targetMinutesPerMatch: number;
};

export type PlaylistEntry = {
  sponsorId: string;
  /** Hold-modus: seconden dat dit item fullscreen getoond wordt. */
  durationSec: number;
};

/** Vaste ids; `live` mag niet verwijderd worden. */
export const LIVE_SEGMENT_ID = "live";

export type PlaylistSegment = {
  id: string;
  label: string;
  playlist: PlaylistEntry[];
  /** Zo niet aangevinkt: gebruik `playbackMode` + `scrollLoopDurationSec` van dit segment i.p.v. globaal. */
  useGlobalSettings: boolean;
  playbackMode: PlaybackMode;
  scrollLoopDurationSec: number;
};

export type LedContentState = {
  settings: ContentSettings;
  sponsors: Sponsor[];
  segments: PlaylistSegment[];
  /** Welke segment-playlist nu op het uitgangsscherm hoort (incl. fallback naar live). */
  activeSegmentId: string;
};

export type ResolvedPlaylistEntry = {
  sponsor: Sponsor;
  durationSec: number;
};

export type LivePlaybackStatus = "playing" | "paused";

export type LiveOverrideMode = "normal" | "blackout" | "testPattern";

export type LiveCueScope = "all";

export type LivePlaybackCue = {
  id: string;
  label: string;
  sponsorId: string;
  durationSec: number;
  startedAtMs: number;
  returnToSegmentId: string | null;
  scope: LiveCueScope;
};

export type LivePlaybackState = {
  status: LivePlaybackStatus;
  overrideMode: LiveOverrideMode;
  /** Tijdelijke wedstrijdcue die bovenop de normale playlist wordt getoond. */
  activeCue: LivePlaybackCue | null;
  /** Huidige positie binnen de effectieve playlist. Wordt per zone tegen de playlistlengte begrensd. */
  itemIndex: number;
  /** Moment waarop het huidige item is gestart. */
  itemStartedAtMs: number;
  /** Reeds afgespeelde tijd op het huidige item wanneer gepauzeerd. */
  pausedElapsedMs: number;
  /** Zones die door de operator als gekoppelde startgroep zijn geselecteerd. */
  linkedZoneIds: string[];
  updatedAtMs: number;
};

export type MatchPlanBlock = {
  id: string;
  label: string;
  /** Minuut op de matchtijdlijn. Mag negatief zijn voor pre-match. */
  startMinute: number;
  endMinute: number;
  segmentId: string;
};

export type MatchPlanState = {
  enabled: boolean;
  running: boolean;
  startedAtMs: number | null;
  pausedElapsedMs: number;
  activeBlockId: string | null;
  blocks: MatchPlanBlock[];
  updatedAtMs: number;
};
