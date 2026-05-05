import type { LedZone } from "@/types";

const STORAGE_KEY = "ledboarding.zones.v1";

function randomId(): string {
  return `z_${Math.random().toString(36).slice(2, 11)}`;
}

export function defaultZones(): LedZone[] {
  return [
    {
      id: randomId(),
      name: "Veld perimeter",
      widthPx: 4992,
      heightPx: 320,
    },
  ];
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
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultZones();
    return parsed.filter(isLedZone);
  } catch {
    return defaultZones();
  }
}

export function saveZones(zones: LedZone[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent("ledboarding-update"));
  });
}

export function patchZoneSegment(zoneId: string, segmentId: string | null): void {
  const zones = loadZones().map((z) =>
    z.id === zoneId ? { ...z, segmentId: segmentId?.trim() || null } : z,
  );
  saveZones(zones);
}

function isLedZone(x: unknown): x is LedZone {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const segmentOk =
    o.segmentId === undefined ||
    o.segmentId === null ||
    (typeof o.segmentId === "string" && o.segmentId.length <= 128);
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.widthPx === "number" &&
    typeof o.heightPx === "number" &&
    o.widthPx >= 64 &&
    o.widthPx <= 32768 &&
    o.heightPx >= 32 &&
    o.heightPx <= 8192 &&
    segmentOk
  );
}
