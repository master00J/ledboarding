import { loadContent } from "@/contentStorage";
import { loadLivePlayback } from "@/livePlaybackStorage";
import { effectiveSegmentId, resolveActivePlaylist } from "@/playlistResolve";
import { loadZones } from "@/zoneStorage";

export type LedAiChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LedAiActionType =
  | "createZone"
  | "updateZone"
  | "assignZoneSegment"
  | "createSegment"
  | "renameSegment"
  | "createTextSponsor"
  | "setPlaylist"
  | "setPlaylistDurations"
  | "setPlaybackSettings"
  | "setBrightness"
  | "setFadeTransition"
  | "linkZones";

export type LedAiAction = {
  type: LedAiActionType;
  label: string;
  payload: Record<string, unknown>;
};

export type LedAiAssistantResponse = {
  message: string;
  actions: LedAiAction[];
};

const DEFAULT_AI_BASE_URL = "https://arenacue.be";

export function buildLedAiSetupSnapshot() {
  const content = loadContent();
  const zones = loadZones();
  const live = loadLivePlayback();
  const sponsorById = new Map(content.sponsors.map((sponsor) => [sponsor.id, sponsor]));

  return {
    app: "ArenaCue LED boarding",
    settings: content.settings,
    activeSegmentId: content.activeSegmentId,
    zones: zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      widthPx: zone.widthPx,
      heightPx: zone.heightPx,
      segmentId: zone.segmentId ?? null,
      processorName: zone.processorName ?? null,
      outputDisplayId: zone.outputDisplayId ?? null,
      regions: (zone.regions ?? []).map((region) => ({
        id: region.id,
        name: region.name,
        xPx: region.xPx,
        yPx: region.yPx,
        widthPx: region.widthPx,
        heightPx: region.heightPx,
        segmentId: region.segmentId ?? null,
      })),
      effectiveSegmentId: effectiveSegmentId(content, zone),
      playlistCount: resolveActivePlaylist(content, zone).length,
    })),
    segments: content.segments.map((segment) => ({
      id: segment.id,
      label: segment.label,
      useGlobalSettings: segment.useGlobalSettings,
      playbackMode: segment.playbackMode,
      scrollLoopDurationSec: segment.scrollLoopDurationSec,
      playlist: segment.playlist.map((entry) => ({
        sponsorId: entry.sponsorId,
        sponsorLabel: sponsorById.get(entry.sponsorId)?.label ?? entry.sponsorId,
        durationSec: entry.durationSec,
      })),
    })),
    sponsors: content.sponsors.map((sponsor) => ({
      id: sponsor.id,
      label: sponsor.label,
      contentKind: sponsor.contentKind,
      hasMedia: Boolean(sponsor.mediaSrc),
      mediaTitle: sponsor.mediaTitle,
      mediaDurationSec: sponsor.mediaDurationSec,
      mediaFit: sponsor.mediaFit,
      bgColor: sponsor.bgColor,
      textColor: sponsor.textColor,
      targetMinutesPerMatch: sponsor.targetMinutesPerMatch,
    })),
    live: {
      status: live.status,
      overrideMode: live.overrideMode,
      itemIndex: live.itemIndex,
      linkedZoneIds: live.linkedZoneIds,
    },
  };
}

export async function askLedAiSetupAssistant(
  messages: LedAiChatMessage[],
  signal?: AbortSignal,
): Promise<LedAiAssistantResponse> {
  const endpoint = `${resolveAiBaseUrl()}/api/ledboarding/setup-assistant`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.slice(-16),
      snapshot: buildLedAiSetupSnapshot(),
    }),
    signal,
  });

  const data = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const error =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : "De AI setupassistent is momenteel niet bereikbaar.";
    throw new Error(error);
  }

  return normalizeAssistantResponse(data);
}

function resolveAiBaseUrl(): string {
  const raw = import.meta.env.VITE_ARENACUE_AI_BASE_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : DEFAULT_AI_BASE_URL;
}

function normalizeAssistantResponse(data: unknown): LedAiAssistantResponse {
  if (!data || typeof data !== "object") {
    return { message: "Ik kreeg geen geldig antwoord van de AI setupassistent.", actions: [] };
  }
  const obj = data as { message?: unknown; actions?: unknown };
  const message =
    typeof obj.message === "string" && obj.message.trim()
      ? obj.message.trim()
      : "Ik heb een voorstel gemaakt voor de LED boarding setup.";
  const actions = Array.isArray(obj.actions)
    ? obj.actions.map(normalizeAction).filter((action): action is LedAiAction => Boolean(action)).slice(0, 10)
    : [];
  return { message, actions };
}

function normalizeAction(action: unknown): LedAiAction | null {
  if (!action || typeof action !== "object") return null;
  const obj = action as { type?: unknown; label?: unknown; payload?: unknown };
  if (typeof obj.type !== "string" || !isActionType(obj.type)) return null;
  return {
    type: obj.type,
    label:
      typeof obj.label === "string" && obj.label.trim()
        ? obj.label.trim()
        : `Voer ${obj.type} uit`,
    payload: obj.payload && typeof obj.payload === "object" ? obj.payload as Record<string, unknown> : {},
  };
}

function isActionType(value: string): value is LedAiActionType {
  return [
    "createZone",
    "updateZone",
    "assignZoneSegment",
    "createSegment",
    "renameSegment",
    "createTextSponsor",
    "setPlaylist",
    "setPlaylistDurations",
    "setPlaybackSettings",
    "setBrightness",
    "setFadeTransition",
    "linkZones",
  ].includes(value);
}
