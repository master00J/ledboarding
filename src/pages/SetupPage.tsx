import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { LedZone } from "@/types";
import { loadZones, saveZones } from "@/zoneStorage";

function randomId(): string {
  return `z_${Math.random().toString(36).slice(2, 11)}`;
}

export function SetupPage() {
  const [zones, setZones] = useState<LedZone[]>(() => loadZones());

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
          Configureer per zone de pixelmaten die overeenkomen met de ingang van je LED-controller.
          Op het uitgangsscherm wordt exact dit canvas gerenderd (letterboxed op je monitor). Zet
          Windows waar mogelijk op dezelfde resolutie als de controller voor scherpste output.
        </p>
      </header>

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
            <p className="mt-3 font-mono text-xs text-zinc-500">
              {z.widthPx} × {z.heightPx} px
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function clampZone(z: LedZone): LedZone {
  return {
    ...z,
    widthPx: Math.min(32768, Math.max(64, Math.round(z.widthPx))),
    heightPx: Math.min(8192, Math.max(32, Math.round(z.heightPx))),
    name: z.name.trim() || "Zone",
  };
}
