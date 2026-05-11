import type { LedAiAction } from "@/aiSetupAssistant";
import { loadContent, saveContent } from "@/contentStorage";
import { setLinkedZoneIds } from "@/livePlaybackStorage";
import type { LedContentState, LedZone, PlaybackMode, PlaylistSegment, Sponsor } from "@/types";
import { loadZones, saveZones } from "@/zoneStorage";

export type LedAiApplyResult = {
  applied: string[];
  skipped: string[];
};

export function applyLedAiActions(actions: LedAiAction[]): LedAiApplyResult {
  let content = loadContent();
  let zones = loadZones();
  const applied: string[] = [];
  const skipped: string[] = [];
  let contentChanged = false;
  let zonesChanged = false;

  for (const action of actions) {
    const result = applyOneAction(action, content, zones);
    if (!result.ok) {
      skipped.push(`${action.label}: ${result.reason}`);
      continue;
    }
    content = result.content;
    zones = result.zones;
    contentChanged = contentChanged || result.contentChanged;
    zonesChanged = zonesChanged || result.zonesChanged;
    applied.push(action.label);
  }

  if (contentChanged) saveContent(content);
  if (zonesChanged) saveZones(zones);

  return { applied, skipped };
}

export function describeLedAiAction(action: LedAiAction): string {
  const p = action.payload;
  if (action.type === "createZone") {
    return `${text(p.name, "Nieuwe zone")} (${numberText(p.widthPx)} x ${numberText(p.heightPx)}px)`;
  }
  if (action.type === "updateZone") return `Zone aanpassen: ${text(p.zoneId, "onbekende zone")}`;
  if (action.type === "assignZoneSegment") return `Zone ${text(p.zoneId, "?")} koppelen aan segment ${text(p.segmentId, "?")}`;
  if (action.type === "createSegment") return `Segment maken: ${text(p.label, "Segment")}`;
  if (action.type === "renameSegment") return `Segment hernoemen naar ${text(p.label, "Segment")}`;
  if (action.type === "createTextSponsor") return `Sponsoritem maken: ${text(p.label, "Sponsor")}`;
  if (action.type === "setPlaylist") return `Playlist vullen voor segment ${text(p.segmentId, "?")}`;
  if (action.type === "setPlaylistDurations") return `Duur instellen op ${numberText(p.durationSec)}s`;
  if (action.type === "setPlaybackSettings") return `Playback instellen op ${text(p.playbackMode, "huidige modus")}`;
  if (action.type === "setBrightness") return `Brightness naar ${numberText(p.brightnessPercent)}%`;
  if (action.type === "setFadeTransition") return `Fade naar ${numberText(p.fadeTransitionMs)}ms`;
  if (action.type === "linkZones") return `Zones koppelen voor gezamenlijke start`;
  return action.label;
}

type ActionResult =
  | {
      ok: true;
      content: LedContentState;
      zones: LedZone[];
      contentChanged: boolean;
      zonesChanged: boolean;
    }
  | { ok: false; reason: string };

function applyOneAction(action: LedAiAction, content: LedContentState, zones: LedZone[]): ActionResult {
  const p = action.payload;

  if (action.type === "createZone") {
    const name = readString(p.name, 160);
    const widthPx = readNumber(p.widthPx, 64, 32768, 1920);
    const heightPx = readNumber(p.heightPx, 32, 8192, 256);
    if (!name) return fail("zonenaam ontbreekt");
    const segmentId = readExistingSegmentId(p.segmentId, content);
    const zone: LedZone = {
      id: uniqueId("z", zones.map((z) => z.id)),
      name,
      widthPx,
      heightPx,
      processorName: readString(p.processorName, 160),
      outputDisplayId: readOptionalNumber(p.outputDisplayId, 0, 100),
      segmentId,
      regions: [],
    };
    return ok(content, [...zones, zone], false, true);
  }

  if (action.type === "updateZone") {
    const zoneId = readString(p.zoneId, 128);
    if (!zoneId) return fail("zoneId ontbreekt");
    let found = false;
    const nextZones = zones.map((zone) => {
      if (zone.id !== zoneId) return zone;
      found = true;
      return clampZone({
        ...zone,
        name: readString(p.name, 160) ?? zone.name,
        widthPx: readOptionalNumber(p.widthPx, 64, 32768) ?? zone.widthPx,
        heightPx: readOptionalNumber(p.heightPx, 32, 8192) ?? zone.heightPx,
        processorName: readString(p.processorName, 160) ?? zone.processorName,
        outputDisplayId: readOptionalNumber(p.outputDisplayId, 0, 100) ?? zone.outputDisplayId,
        segmentId: readExistingSegmentId(p.segmentId, content) ?? zone.segmentId ?? null,
      });
    });
    if (!found) return fail("zone niet gevonden");
    return ok(content, nextZones, false, true);
  }

  if (action.type === "assignZoneSegment") {
    const zoneId = readString(p.zoneId, 128);
    const segmentId = readExistingSegmentId(p.segmentId, content);
    if (!zoneId || !segmentId) return fail("zone of segment ontbreekt");
    let found = false;
    const nextZones = zones.map((zone) => {
      if (zone.id !== zoneId) return zone;
      found = true;
      return { ...zone, segmentId };
    });
    if (!found) return fail("zone niet gevonden");
    return ok(content, nextZones, false, true);
  }

  if (action.type === "createSegment") {
    const label = readString(p.label, 160);
    if (!label) return fail("segmentnaam ontbreekt");
    const existingIds = content.segments.map((segment) => segment.id);
    const wantedId = sanitizeId(readString(p.id, 80) ?? "");
    const id = wantedId && !existingIds.includes(wantedId) ? wantedId : uniqueId("seg", existingIds);
    const playbackMode = readPlaybackMode(p.playbackMode) ?? "scroll";
    const segment: PlaylistSegment = {
      id,
      label,
      playlist: [],
      useGlobalSettings: typeof p.useGlobalSettings === "boolean" ? p.useGlobalSettings : true,
      playbackMode,
      scrollLoopDurationSec: readNumber(p.scrollLoopDurationSec, 12, 240, 42),
    };
    return ok({ ...content, segments: [...content.segments, segment] }, zones, true, false);
  }

  if (action.type === "renameSegment") {
    const segmentId = readString(p.segmentId, 128);
    const label = readString(p.label, 160);
    if (!segmentId || !label) return fail("segmentId of label ontbreekt");
    let found = false;
    const segments = content.segments.map((segment) => {
      if (segment.id !== segmentId) return segment;
      found = true;
      return { ...segment, label };
    });
    if (!found) return fail("segment niet gevonden");
    return ok({ ...content, segments }, zones, true, false);
  }

  if (action.type === "createTextSponsor") {
    const label = readString(p.label, 180);
    if (!label) return fail("sponsornaam ontbreekt");
    const sponsor: Sponsor = {
      id: uniqueId("s", content.sponsors.map((item) => item.id)),
      label,
      bgColor: readHex(p.bgColor) ?? "#18181b",
      textColor: readHex(p.textColor) ?? "#ffffff",
      logoDataUrl: null,
      contentKind: "text",
      mediaSrc: null,
      mediaTitle: null,
      mediaFit: "contain",
      targetMinutesPerMatch: readNumber(p.targetMinutesPerMatch, 0, 999, 0),
    };
    return ok({ ...content, sponsors: [...content.sponsors, sponsor] }, zones, true, false);
  }

  if (action.type === "setPlaylist") {
    const segmentId = readString(p.segmentId, 128);
    if (!segmentId) return fail("segmentId ontbreekt");
    const sponsorIds = resolveSponsorIds(p, content);
    if (sponsorIds.length === 0) return fail("geen bestaande sponsors gevonden");
    const durationSec = readNumber(p.durationSec, 2, 600, 15);
    const segments = content.segments.map((segment) =>
      segment.id === segmentId
        ? { ...segment, playlist: sponsorIds.map((sponsorId) => ({ sponsorId, durationSec })) }
        : segment,
    );
    if (!segments.some((segment) => segment.id === segmentId)) return fail("segment niet gevonden");
    return ok({ ...content, segments }, zones, true, false);
  }

  if (action.type === "setPlaylistDurations") {
    const segmentId = readString(p.segmentId, 128);
    const durationSec = readOptionalNumber(p.durationSec, 2, 600);
    if (!segmentId || durationSec === undefined) return fail("segmentId of duur ontbreekt");
    let found = false;
    const segments = content.segments.map((segment) => {
      if (segment.id !== segmentId) return segment;
      found = true;
      return {
        ...segment,
        playlist: segment.playlist.map((entry) => ({ ...entry, durationSec })),
      };
    });
    if (!found) return fail("segment niet gevonden");
    return ok({ ...content, segments }, zones, true, false);
  }

  if (action.type === "setPlaybackSettings") {
    const playbackMode = readPlaybackMode(p.playbackMode);
    const scrollLoopDurationSec = readOptionalNumber(p.scrollLoopDurationSec, 12, 240);
    if (!playbackMode && scrollLoopDurationSec === undefined) return fail("geen playbackinstelling gevonden");
    return ok(
      {
        ...content,
        settings: {
          ...content.settings,
          playbackMode: playbackMode ?? content.settings.playbackMode,
          scrollLoopDurationSec: scrollLoopDurationSec ?? content.settings.scrollLoopDurationSec,
        },
      },
      zones,
      true,
      false,
    );
  }

  if (action.type === "setBrightness") {
    const brightnessPercent = readOptionalNumber(p.brightnessPercent, 1, 100);
    if (brightnessPercent === undefined) return fail("brightness ontbreekt");
    return ok({ ...content, settings: { ...content.settings, brightnessPercent } }, zones, true, false);
  }

  if (action.type === "setFadeTransition") {
    const fadeTransitionMs = readOptionalNumber(p.fadeTransitionMs, 0, 2000);
    if (fadeTransitionMs === undefined) return fail("fade ontbreekt");
    return ok({ ...content, settings: { ...content.settings, fadeTransitionMs } }, zones, true, false);
  }

  if (action.type === "linkZones") {
    const zoneIds = readStringArray(p.zoneIds, 50, 128).filter((id) => zones.some((zone) => zone.id === id));
    if (zoneIds.length === 0) return fail("geen bestaande zones om te koppelen");
    setLinkedZoneIds(zoneIds);
    return ok(content, zones, false, false);
  }

  return fail("onbekende actie");
}

function ok(
  content: LedContentState,
  zones: LedZone[],
  contentChanged: boolean,
  zonesChanged: boolean,
): ActionResult {
  return { ok: true, content, zones, contentChanged, zonesChanged };
}

function fail(reason: string): ActionResult {
  return { ok: false, reason };
}

function resolveSponsorIds(payload: Record<string, unknown>, content: LedContentState): string[] {
  const existing = new Set(content.sponsors.map((sponsor) => sponsor.id));
  const ids = readStringArray(payload.sponsorIds, 80, 128).filter((id) => existing.has(id));
  const labels = readStringArray(payload.sponsorLabels, 80, 180);
  for (const label of labels) {
    const match = content.sponsors.find((sponsor) => sponsor.label.toLowerCase() === label.toLowerCase());
    if (match) ids.push(match.id);
  }
  return Array.from(new Set(ids));
}

function readExistingSegmentId(value: unknown, content: LedContentState): string | null {
  const id = readString(value, 128);
  return id && content.segments.some((segment) => segment.id === id) ? id : null;
}

function readPlaybackMode(value: unknown): PlaybackMode | null {
  return value === "hold" || value === "scroll" ? value : null;
}

function readString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function readStringArray(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, maxLen))
        .filter(Boolean),
    ),
  ).slice(0, maxItems);
}

function readNumber(value: unknown, min: number, max: number, fallback: number): number {
  return readOptionalNumber(value, min, max) ?? fallback;
}

function readOptionalNumber(value: unknown, min: number, max: number): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function readHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
}

function uniqueId(prefix: string, existingIds: string[]): string {
  const existing = new Set(existingIds);
  for (let i = 0; i < 20; i += 1) {
    const id = `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
    if (!existing.has(id)) return id;
  }
  return `${prefix}_${Date.now()}`;
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

function clampZone(zone: LedZone): LedZone {
  return {
    ...zone,
    name: zone.name.trim() || "Zone",
    widthPx: Math.min(32768, Math.max(64, Math.round(zone.widthPx))),
    heightPx: Math.min(8192, Math.max(32, Math.round(zone.heightPx))),
    processorName: zone.processorName?.trim() ? zone.processorName.trim().slice(0, 160) : null,
    segmentId: zone.segmentId?.trim() ? zone.segmentId.trim().slice(0, 128) : null,
    outputDisplayId:
      typeof zone.outputDisplayId === "number" && Number.isFinite(zone.outputDisplayId)
        ? Math.round(zone.outputDisplayId)
        : null,
    regions: zone.regions ?? [],
  };
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberText(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? String(Math.round(n)) : "?";
}
