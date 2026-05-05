export type LedZone = {
  id: string;
  name: string;
  /** Pixelbreedte zoals de LED-controller / uitgang verwacht */
  widthPx: number;
  /** Pixelhoogte zoals de LED-controller / uitgang verwacht */
  heightPx: number;
};

/** Doorlopende crawl langs alle playlist-items, of elk item als vast segment. */
export type PlaybackMode = "scroll" | "hold";

export type ContentSettings = {
  playbackMode: PlaybackMode;
  /** Scroll-modus: tijd voor één volledige passage over alle playlist-items (één “ronde”). */
  scrollLoopDurationSec: number;
};

export type Sponsor = {
  id: string;
  /** Tekst op de boarding */
  label: string;
  /** Achtergrondkleur (#rrggbb) of leeg voor standaard */
  bgColor: string | null;
  /** Tekstkleur (#rrggbb) of leeg voor wit */
  textColor: string | null;
};

export type PlaylistEntry = {
  sponsorId: string;
  /** Hold-modus: seconden dat dit item fullscreen getoond wordt. */
  durationSec: number;
};

export type LedContentState = {
  settings: ContentSettings;
  sponsors: Sponsor[];
  playlist: PlaylistEntry[];
};

export type ResolvedPlaylistEntry = {
  sponsor: Sponsor;
  durationSec: number;
};
