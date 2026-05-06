import { Link } from "react-router-dom";
import { type ReactNode, useEffect, useMemo, useReducer, useState } from "react";
import type { LedRegion, LedZone } from "@/types";
import { loadContent, setActiveSegment } from "@/contentStorage";
import { SetupContentSection } from "@/pages/SetupContentSection";
import { TextureExportSection } from "@/pages/TextureExportSection";
import { loadZones, saveZones } from "@/zoneStorage";

function randomId(): string {
  return `z_${Math.random().toString(36).slice(2, 11)}`;
}

type SetupTab = "dashboard" | "zones" | "texture" | "content" | "playlists" | "backup";

export function SetupPage() {
  const [tab, setTab] = useState<SetupTab>("dashboard");
  const [zones, setZones] = useState<LedZone[]>(() => loadZones());
  const [segTick, bumpSeg] = useReducer((n: number) => n + 1, 0);
  const [openOutputs, setOpenOutputs] = useState<string[]>([]);

  useEffect(() => {
    function onContentChange() {
      bumpSeg();
    }
    window.addEventListener("ledboarding-update", onContentChange);
    return () => window.removeEventListener("ledboarding-update", onContentChange);
  }, []);

  const boardSegments = useMemo(() => loadContent().segments, [segTick]);
  const boardContent = useMemo(() => loadContent(), [segTick]);
  const activeSegment = boardSegments.find((s) => s.id === boardContent.activeSegmentId) ?? boardSegments[0];

  useEffect(() => {
    let cancelled = false;
    void window.ledboarding?.listOutputWindows().then((ids) => {
      if (!cancelled) setOpenOutputs(ids);
    });
    const unsubscribe = window.ledboarding?.onOutputWindowsChanged(setOpenOutputs);
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

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

  function addRegion(zone: LedZone) {
    const count = zone.regions?.length ?? 0;
    const widthPx = Math.max(1, Math.round(zone.widthPx / 3));
    const heightPx = zone.heightPx;
    const region: LedRegion = {
      id: randomId(),
      name: `Subzone ${count + 1}`,
      xPx: Math.min(zone.widthPx - widthPx, count * widthPx),
      yPx: 0,
      widthPx,
      heightPx,
      segmentId: null,
    };
    update(zone.id, { regions: [...(zone.regions ?? []), region] });
  }

  function updateRegion(zone: LedZone, regionId: string, patch: Partial<LedRegion>) {
    const regions = (zone.regions ?? []).map((r) =>
      r.id === regionId ? clampRegion({ ...r, ...patch }, zone.widthPx, zone.heightPx) : r,
    );
    update(zone.id, { regions });
  }

  function removeRegion(zone: LedZone, regionId: string) {
    update(zone.id, { regions: (zone.regions ?? []).filter((r) => r.id !== regionId) });
  }

  async function openOutput(zoneId: string) {
    if (window.ledboarding) {
      await window.ledboarding.openOutput(zoneId);
      setOpenOutputs(await window.ledboarding.listOutputWindows());
      return;
    }
    window.open(`#/display/${encodeURIComponent(zoneId)}`, "_blank", "noopener,noreferrer");
  }

  async function focusOutput(zoneId: string) {
    if (window.ledboarding) await window.ledboarding.focusOutput(zoneId);
  }

  async function closeOutput(zoneId: string) {
    if (!window.ledboarding) return;
    await window.ledboarding.closeOutput(zoneId);
    setOpenOutputs(await window.ledboarding.listOutputWindows());
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">ArenaCue LED boarding</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Eén control panel voor zones, outputvensters, content en playlists.
        </p>
      </header>

      <nav className="mb-8 flex flex-wrap gap-2 border-b border-zinc-800 pb-px">
        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
          Dashboard
        </TabButton>
        <TabButton active={tab === "zones"} onClick={() => setTab("zones")}>
          Zones &amp; output
        </TabButton>
        <TabButton active={tab === "texture"} onClick={() => setTab("texture")}>
          Texture-export
        </TabButton>
        <TabButton active={tab === "content"} onClick={() => setTab("content")}>
          Content
        </TabButton>
        <TabButton active={tab === "playlists"} onClick={() => setTab("playlists")}>
          Playlists
        </TabButton>
        <TabButton active={tab === "backup"} onClick={() => setTab("backup")}>
          Backup
        </TabButton>
      </nav>

      {tab === "dashboard" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Live bediening</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Kies het globale segment en beheer de outputvensters per LED-zone.
                </p>
              </div>
              <label className="min-w-[240px]">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Globaal actief segment
                </span>
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={activeSegment?.id ?? ""}
                  onChange={(e) => {
                    setActiveSegment(e.target.value);
                    bumpSeg();
                  }}
                >
                  {boardSegments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <InfoCard label="Zones" value={String(zones.length)} />
              <InfoCard label="Outputvensters open" value={String(openOutputs.length)} />
              <InfoCard label="Segment" value={activeSegment?.label ?? "—"} />
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Texture voor LED-controller</h2>
                <p className="mt-1 max-w-2xl text-sm text-zinc-400">
                  Maak van één sponsorbanner een PNG in exacte pixelmaten (strip + canvas) voor hardware
                  die geen live HTML gebruikt — o.a. perimeter en hoeklint-setups.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTab("texture")}
                className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Open texture-export
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Outputs</h2>
              <button
                type="button"
                onClick={() => setTab("zones")}
                className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Zones beheren
              </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {sorted.map((z) => {
                const open = openOutputs.includes(z.id);
                const seg = z.segmentId
                  ? boardSegments.find((s) => s.id === z.segmentId)?.label ?? "Onbekend segment"
                  : activeSegment?.label ?? "Globaal";
                return (
                  <div key={z.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{z.name}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {z.widthPx} × {z.heightPx}px · {z.segmentId ? "vast" : "globaal"}: {seg}
                        </div>
                      </div>
                      <span className={open ? "text-xs text-emerald-400" : "text-xs text-zinc-500"}>
                        {open ? "Open" : "Gesloten"}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void openOutput(z.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
                      >
                        {open ? "Opnieuw openen" : "Output openen"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void focusOutput(z.id)}
                        disabled={!open || !window.ledboarding}
                        className="rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Focus
                      </button>
                      <button
                        type="button"
                        onClick={() => void closeOutput(z.id)}
                        disabled={!open || !window.ledboarding}
                        className="rounded-lg border border-red-900/60 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Sluiten
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {tab === "texture" && <TextureExportSection />}

      {tab === "content" && <SetupContentSection view="content" />}
      {tab === "playlists" && <SetupContentSection view="playlists" />}
      {tab === "backup" && <SetupContentSection view="backup" />}

      {tab === "zones" && (
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
                  onClick={() => void openOutput(z.id)}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Electron output
                </button>
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
            <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Subzones / vaste plekken</h3>
                  <p className="mt-1 max-w-2xl text-xs text-zinc-500">
                    Gebruik dit als één output-canvas meerdere vaste sponsorplekken bevat. Positie en grootte
                    zijn pixels binnen deze zone. Zonder subzones vult de zone gewoon het volledige canvas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addRegion(z)}
                  className="rounded-lg border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
                >
                  Subzone toevoegen
                </button>
              </div>
              {(z.regions?.length ?? 0) > 0 ? (
                <div className="mt-4 space-y-3">
                  {z.regions!.map((region) => (
                    <div
                      key={region.id}
                      className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 lg:grid-cols-[minmax(160px,1fr)_repeat(4,5.5rem)_minmax(180px,1fr)_auto]"
                    >
                      <label>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                          Naam
                        </span>
                        <input
                          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/50"
                          value={region.name}
                          onChange={(e) => updateRegion(z, region.id, { name: e.target.value })}
                        />
                      </label>
                      <NumberField
                        label="X"
                        value={region.xPx}
                        min={0}
                        max={z.widthPx}
                        onChange={(value) => updateRegion(z, region.id, { xPx: value })}
                      />
                      <NumberField
                        label="Y"
                        value={region.yPx}
                        min={0}
                        max={z.heightPx}
                        onChange={(value) => updateRegion(z, region.id, { yPx: value })}
                      />
                      <NumberField
                        label="Breedte"
                        value={region.widthPx}
                        min={1}
                        max={z.widthPx}
                        onChange={(value) => updateRegion(z, region.id, { widthPx: value })}
                      />
                      <NumberField
                        label="Hoogte"
                        value={region.heightPx}
                        min={1}
                        max={z.heightPx}
                        onChange={(value) => updateRegion(z, region.id, { heightPx: value })}
                      />
                      <label>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                          Segment
                        </span>
                        <select
                          className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500/50"
                          value={region.segmentId ?? ""}
                          onChange={(e) =>
                            updateRegion(z, region.id, {
                              segmentId: e.target.value === "" ? null : e.target.value,
                            })
                          }
                        >
                          <option value="">Volgt zone/globaal</option>
                          {boardSegments.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeRegion(z, region.id)}
                        className="self-end rounded-lg border border-red-900/60 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40"
                      >
                        Verwijder
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-zinc-600">
                  Geen subzones ingesteld. Deze output toont één playlist over het volledige canvas.
                </p>
              )}
            </div>
          </li>
        ))}
          </ul>
        </>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
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
  const widthPx = Math.min(32768, Math.max(64, Math.round(z.widthPx)));
  const heightPx = Math.min(8192, Math.max(32, Math.round(z.heightPx)));
  return {
    ...z,
    widthPx,
    heightPx,
    name: z.name.trim() || "Zone",
    segmentId,
    regions: (z.regions ?? []).map((r) => clampRegion(r, widthPx, heightPx)),
  };
}

function clampRegion(region: LedRegion, zoneW: number, zoneH: number): LedRegion {
  const widthPx = Math.min(zoneW, Math.max(1, Math.round(region.widthPx)));
  const heightPx = Math.min(zoneH, Math.max(1, Math.round(region.heightPx)));
  const xPx = Math.min(Math.max(0, zoneW - widthPx), Math.max(0, Math.round(region.xPx)));
  const yPx = Math.min(Math.max(0, zoneH - heightPx), Math.max(0, Math.round(region.yPx)));
  const segmentId =
    region.segmentId === undefined || region.segmentId === null || String(region.segmentId).trim() === ""
      ? null
      : String(region.segmentId).trim().slice(0, 128);
  return {
    ...region,
    name: region.name.trim() || "Subzone",
    xPx,
    yPx,
    widthPx,
    heightPx,
    segmentId,
  };
}
