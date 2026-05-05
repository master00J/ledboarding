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
