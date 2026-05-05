export type LedZone = {
  id: string;
  name: string;
  /** Pixelbreedte zoals de LED-controller / uitgang verwacht */
  widthPx: number;
  /** Pixelhoogte zoals de LED-controller / uitgang verwacht */
  heightPx: number;
};
