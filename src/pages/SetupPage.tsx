import { Link } from "react-router-dom";
import { type ReactNode, useEffect, useMemo, useReducer, useState } from "react";
import type { LedZone } from "@/types";
import { loadContent } from "@/contentStorage";
import { SetupContentSection } from "@/pages/SetupContentSection";
import { loadZones, saveZones } from "@/zoneStorage";

function randomId(): string {
  return `z_${Math.random().toString(36).slice(2, 11)}`;
}

type SetupTab = "zones" | "content";

export function SetupPage() {
  const [tab, setTab] = useState<SetupTab>("zones");
  const [zones, setZones] = useState<LedZone[]>(() => loadZones());
  const [segTick, bumpSeg] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    function onContentChange() {
      bumpSeg();
    }
    window.addEventListener("ledboarding-update", onContentChange);
    return () => window.removeEventListener("ledboarding-update", onContentChange);
  }, []);

  const boardSegments = useMemo(() => loadContent().segments, [segTick]);

  useEffect(() => {
    saveZones(zones);
  }, [zones]);

  const sorted = useMemo(
    () => [...zones].sort((a, b) => a.name.localeCompare(b.name, "nl")),
    [zones],
  );

  function update(id: string, patch: Partial<LedZone>) {
    setZones((prev) =>
      prev.map((z) => (z.id === id ? { ...z, ...clampZone({ ...z, ...patch }) } : z)),
    );
  }

  function addZone() {
    setZones((prev) => [
      ...prev,
      {
        id: randomId(),
        name: `Zone ${prev.length + 1}`,
        widthPx: 1920,
        heightPx: 256,
      },
    ]);
  }

  function removeZone(id: string) {
    setZones((prev) => (prev.length <= 1 ? prev : prev.filter((z) => z.id !== id)));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">LED boarding</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Zones: resolutie per uitgang naar je controller. Content: sponsors en playlist.
        </p>
      </header>

      <nav className="mb-8 flex gap-2 border-b border-zinc-800 pb-px">
        <TabButton active={tab === "zones"} onClick={() => setTab("zones")}>
          Zones &amp; output
        </TabButton>
        <TabButton active={tab === "content"} onClick={() => setTab("content")}>
          Sponsors &amp; playlist
        </TabButton>
      </nav>

      {tab === "content" ? (
        <SetupContentSection />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={addZone}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
            >
              Zone toevoegen
            </button>
          </div>

          <ul className="space-y-4">
        {sorted.map((z) => (
          <li
            key={z.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-inner"
          >
            <div className="flex flex-wrap items-end gap-4">
              <label className="min-w-[180px] flex-1">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Naam</span>
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none ring-emerald-500/50 focus:ring-2"
                  value={z.name}
                  onChange={(e) => update(z.id, { name: e.target.value })}
                />
              </label>
              <label className="w-28">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Breedte</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={z.widthPx}
                  min={64}
                  max={32768}
                  onChange={(e) => update(z.id, { widthPx: Number(e.target.value) })}
                />
              </label>
              <label className="w-28">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Hoogte</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={z.heightPx}
                  min={32}
                  max={8192}
                  onChange={(e) => update(z.id, { heightPx: Number(e.target.value) })}
                />
              </label>
              <div className="flex flex-wrap gap-2 pb-0.5">
                <Link
                  to={`/display/${z.id}`}
                  className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
                >
                  Output openen
                </Link>
                <button
                  type="button"
                  onClick={() => removeZone(z.id)}
                  disabled={zones.length <= 1}
                  className="rounded-lg border border-red-900/60 px-3 py-2 text-sm text-red-300 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Verwijderen
                </button>
              </div>
            </div>
            <label className="mt-3 block max-w-xl">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                LED-segment (zone)
              </span>
              <select
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                value={z.segmentId ?? ""}
                onChange={(e) =>
                  update(z.id, { segmentId: e.target.value === "" ? null : e.target.value })
                }
              >
                <option value="">Volgt globaal actief segment (aanbevolen)</option>
                {boardSegments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label} ({s.id})
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-zinc-600">
                Handig voor tweede output (tribune vs veld): vaste playlist onafhankelijk van het globaal gekozen segment.
              </span>
            </label>
            <p className="mt-3 font-mono text-xs text-zinc-500">
              {z.widthPx} × {z.heightPx} px
            </p>
          </li>
        ))}
          </ul>
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-zinc-900 text-white ring-1 ring-zinc-700 ring-b-0"
          : "text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function clampZone(z: LedZone): LedZone {
  const segmentId =
    z.segmentId === undefined || z.segmentId === null || String(z.segmentId).trim() === ""
      ? null
      : String(z.segmentId).trim().slice(0, 128);
  return {
    ...z,
    widthPx: Math.min(32768, Math.max(64, Math.round(z.widthPx))),
    heightPx: Math.min(8192, Math.max(32, Math.round(z.heightPx))),
    name: z.name.trim() || "Zone",
    segmentId,
  };
}
