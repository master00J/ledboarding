import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";

const execFileP = promisify(execFile);

export const VIDEO_EXT = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".avi",
  ".mkv",
  ".m4v",
  ".wmv",
  ".mpeg",
  ".mpg",
]);

export function isVideoPath(filePath: string): boolean {
  return VIDEO_EXT.has(path.extname(filePath).toLowerCase());
}

/**
 * Eerste decodable frame als PNG (tijdelijk bestand). Caller moet verwijderen na gebruik.
 * `-ss` vóór `-i` voor snellere opening op lange clips.
 */
export async function extractVideoFirstFrameToPngPath(videoPath: string): Promise<string> {
  const bin = ffmpegStatic;
  if (!bin || !fs.existsSync(bin)) {
    throw new Error(
      "FFmpeg-binary niet gevonden. Controleer of ArenaCue LED boarding volledig is geïnstalleerd.",
    );
  }
  const tmp = path.join(
    os.tmpdir(),
    `ledboarding-vframe-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.png`,
  );

  try {
    await execFileP(
      bin,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        "0",
        "-i",
        videoPath,
        "-frames:v",
        "1",
        "-an",
        tmp,
      ],
      { maxBuffer: 80 * 1024 * 1024, windowsHide: true },
    );
  } catch (e) {
    const stderr = e && typeof e === "object" && "stderr" in e ? String((e as { stderr?: unknown }).stderr) : "";
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      stderr.trim()
        ? `Video kon niet worden gelezen: ${stderr.trim().slice(0, 400)}`
        : `Video kon niet worden gelezen: ${msg}`,
    );
  }

  if (!fs.existsSync(tmp)) {
    throw new Error("FFmpeg heeft geen frame geproduceerd.");
  }
  return tmp;
}

export async function probeVideoDurationSec(videoPath: string): Promise<number | null> {
  const bin = ffmpegStatic;
  if (!bin || !fs.existsSync(bin)) return null;
  try {
    await execFileP(
      bin,
      ["-hide_banner", "-i", videoPath],
      { maxBuffer: 4 * 1024 * 1024, windowsHide: true },
    );
    return null;
  } catch (e) {
    const stderr = e && typeof e === "object" && "stderr" in e ? String((e as { stderr?: unknown }).stderr) : "";
    const match = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const total = hours * 3600 + minutes * 60 + seconds;
    if (!Number.isFinite(total) || total <= 0) return null;
    return Math.min(7200, Math.max(1, Math.ceil(total)));
  }
}
