import type { SponsorContentKind } from "@/types";

export function mediaSourceUrl(src: string | null | undefined): string {
  const value = src?.trim();
  if (!value) return "";
  if (/^(data:|blob:|https?:|file:)/i.test(value)) return value;
  const normalized = value.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalized)) return `file:///${encodeURI(normalized)}`;
  if (normalized.startsWith("/")) return `file://${encodeURI(normalized)}`;
  return value;
}

export function mediaTitleFromPath(path: string): string {
  return path.replace(/.*[/\\]/, "") || "Media";
}

export function contentKindFromPath(path: string): SponsorContentKind {
  return /\.(mp4|webm|mov|avi|mkv|m4v|wmv|mpeg|mpg)$/i.test(path) ? "video" : "image";
}
