import type { LedRegion, LedZone } from "@/types";

const STORAGE_KEY = "ledboarding.zones.v1";

export function defaultZones(): LedZone[] {
  return [];
}

export function loadZones(): LedZone[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = defaultZones();
      saveZones(initial);
      return initial;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultZones();
    const zones = parsed.map(normalizeZone).filter(Boolean) as LedZone[];
    return zones;
  } catch {
    return defaultZones();
  }
}

export function saveZones(zones: LedZone[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent("ledboarding-update"));
    window.ledboarding?.notifyStateChanged();
  });
}

export function patchZoneSegment(zoneId: string, segmentId: string | null): void {
  const zones = loadZones().map((z) =>
    z.id === zoneId ? { ...z, segmentId: segmentId?.trim() || null } : z,
  );
  saveZones(zones);
}

function normalizeZone(x: unknown): LedZone | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const segmentOk =
    o.segmentId === undefined ||
    o.segmentId === null ||
    (typeof o.segmentId === "string" && o.segmentId.length <= 128);
  const processorOk =
    o.processorName === undefined ||
    o.processorName === null ||
    (typeof o.processorName === "string" && o.processorName.length <= 160);
  const outputDisplayOk =
    o.outputDisplayId === undefined ||
    o.outputDisplayId === null ||
    (typeof o.outputDisplayId === "number" && Number.isFinite(o.outputDisplayId));
  const valid =
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.widthPx === "number" &&
    typeof o.heightPx === "number" &&
    o.widthPx >= 64 &&
    o.widthPx <= 32768 &&
    o.heightPx >= 32 &&
    o.heightPx <= 8192 &&
    segmentOk &&
    processorOk &&
    outputDisplayOk;
  if (!valid) return null;
  const id = o.id as string;
  const name = o.name as string;
  const widthPx = Math.round(o.widthPx as number);
  const heightPx = Math.round(o.heightPx as number);
  const regionsRaw = Array.isArray(o.regions) ? o.regions : [];
  const regions = regionsRaw
    .map((r) => normalizeRegion(r, widthPx, heightPx))
    .filter(Boolean) as LedRegion[];
  return {
    id,
    name: name.trim() || "Zone",
    widthPx,
    heightPx,
    segmentId:
      typeof o.segmentId === "string" && o.segmentId.trim().length > 0 ? o.segmentId.trim() : null,
    processorName:
      typeof o.processorName === "string" && o.processorName.trim().length > 0
        ? o.processorName.trim().slice(0, 160)
        : null,
    outputDisplayId:
      typeof o.outputDisplayId === "number" && Number.isFinite(o.outputDisplayId)
        ? Math.round(o.outputDisplayId)
        : null,
    regions,
  };
}

function normalizeRegion(x: unknown, zoneW: number, zoneH: number): LedRegion | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  const widthPx = clampNumber(o.widthPx, 1, zoneW, Math.max(1, Math.round(zoneW / 3)));
  const heightPx = clampNumber(o.heightPx, 1, zoneH, zoneH);
  const xPx = clampNumber(o.xPx, 0, Math.max(0, zoneW - widthPx), 0);
  const yPx = clampNumber(o.yPx, 0, Math.max(0, zoneH - heightPx), 0);
  return {
    id: o.id,
    name: o.name.trim() || "Subzone",
    xPx,
    yPx,
    widthPx,
    heightPx,
    segmentId:
      typeof o.segmentId === "string" && o.segmentId.trim().length > 0 ? o.segmentId.trim() : null,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
