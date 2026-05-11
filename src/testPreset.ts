import type { LedContentState, LedZone, PlaylistSegment, Sponsor } from "@/types";
import { LIVE_SEGMENT_ID } from "@/types";

const VISUALS_DIR = "C:\\Users\\V-MIX\\OneDrive\\Desktop\\coding stuff\\ledboarding\\visuals ledboarding";

type TestVisual = {
  id: string;
  label: string;
  fileName: string;
  zoneName: string;
  processorName: string;
  widthPx: number;
  heightPx: number;
};

const TEST_VISUALS: TestVisual[] = [
  {
    id: "pitch",
    label: "LED Pitch",
    fileName: "LED PITCH.mp4",
    zoneName: "Pitch perimeter",
    processorName: "LED PITCH processor",
    widthPx: 1920,
    heightPx: 72,
  },
  {
    id: "luifel",
    label: "LED Luifel",
    fileName: "LED LUIFEL.mp4",
    zoneName: "Luifel perimeter",
    processorName: "LED LUIFEL processor",
    widthPx: 1920,
    heightPx: 72,
  },
  {
    id: "t4_main",
    label: "LED T4 Scherm main",
    fileName: "LED T4 SCHERM.mp4",
    zoneName: "T4 scherm main",
    processorName: "LED T4 SCHERM main processor",
    widthPx: 1920,
    heightPx: 1080,
  },
  {
    id: "t4_backup",
    label: "LED T4 Scherm backup",
    fileName: "LED T4 SCHERM_1.mp4",
    zoneName: "T4 scherm backup",
    processorName: "LED T4 SCHERM backup processor",
    widthPx: 1920,
    heightPx: 1080,
  },
];

export function createLedboardingTestContent(): LedContentState {
  const sponsors: Sponsor[] = TEST_VISUALS.map((visual) => ({
    id: `demo_${visual.id}`,
    label: visual.label,
    bgColor: "#000000",
    textColor: "#ffffff",
    logoDataUrl: null,
    contentKind: "video",
    mediaSrc: `${VISUALS_DIR}\\${visual.fileName}`,
    mediaTitle: visual.fileName,
    mediaDurationSec: null,
    mediaFit: "cover",
    targetMinutesPerMatch: 0,
  }));

  const segments: PlaylistSegment[] = [
    {
      id: LIVE_SEGMENT_ID,
      label: "Test alle LED visuals",
      playlist: sponsors.map((s) => ({ sponsorId: s.id, durationSec: 12 })),
      useGlobalSettings: true,
      playbackMode: "hold",
      scrollLoopDurationSec: 42,
    },
    ...TEST_VISUALS.map((visual) => ({
      id: `seg_${visual.id}`,
      label: visual.label,
      playlist: [{ sponsorId: `demo_${visual.id}`, durationSec: 60 }],
      useGlobalSettings: false,
      playbackMode: "hold" as const,
      scrollLoopDurationSec: 42,
    })),
  ];

  return {
    settings: {
      playbackMode: "hold",
      scrollLoopDurationSec: 42,
      brightnessPercent: 100,
      fadeTransitionMs: 500,
      feedFollowSegment: false,
    },
    sponsors,
    segments,
    activeSegmentId: LIVE_SEGMENT_ID,
  };
}

export function createLedboardingTestZones(): LedZone[] {
  return TEST_VISUALS.map((visual) => ({
    id: `zone_${visual.id}`,
    name: visual.zoneName,
    widthPx: visual.widthPx,
    heightPx: visual.heightPx,
    segmentId: `seg_${visual.id}`,
    processorName: visual.processorName,
    outputDisplayId: null,
    regions: [],
  }));
}
