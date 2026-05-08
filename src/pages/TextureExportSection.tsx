import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyPerimeterPreset,
  loadTextureExportPrefs,
  renderFilenameTemplate,
  saveTextureExportPrefs,
  type TextureBuildPayload,
  type TextureExportPrefs,
} from "@/lib/textureExportPrefs";

function fileNameFromPath(p: string): string {
  const s = p.replace(/\\/g, "/");
  const i = s.lastIndexOf("/");
  return i >= 0 ? s.slice(i + 1) : s;
}

function baseNameFromPath(p: string): string {
  const file = fileNameFromPath(p);
  return file.replace(/\.[^.]+$/, "") || "banner";
}

function buildPayload(prefs: TextureExportPrefs, sourcePath: string): TextureBuildPayload {
  return {
    inputPath: sourcePath,
    stripWidth: prefs.stripWidth,
    stripHeight: prefs.stripHeight,
    canvasWidth: prefs.canvasWidth,
    canvasHeight: prefs.canvasHeight,
    fit: prefs.fit,
    layout: prefs.layout,
    wrappedShiftPx: prefs.wrappedShiftPx,
  };
}

function templateForName(prefs: TextureExportPrefs, sourcePath: string): string {
  return renderFilenameTemplate(prefs.filenameTemplate, {
    name: baseNameFromPath(sourcePath),
    canvasWidth: prefs.canvasWidth,
    canvasHeight: prefs.canvasHeight,
    stripWidth: prefs.stripWidth,
    stripHeight: prefs.stripHeight,
    layout: prefs.layout,
    fit: prefs.fit,
  });
}

type BatchRow = { inputPath: string; ok: boolean; filePath?: string; error?: string };

export function TextureExportSection() {
  const isDesktop = typeof window !== "undefined" && Boolean(window.ledboarding?.texturePreview);

  const [prefs, setPrefs] = useState<TextureExportPrefs>(() => loadTextureExportPrefs());
  const [sourcePath, setSourcePath] = useState(() => loadTextureExportPrefs().lastSourcePath);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((next: TextureExportPrefs) => {
    setPrefs(next);
    saveTextureExportPrefs(next);
  }, []);

  const pickSource = useCallback(async () => {
    if (!window.ledboarding?.textureSelectSource) return;
    const p = await window.ledboarding.textureSelectSource();
    if (!p) return;
    setSourcePath(p);
    const next = { ...prefs, lastSourcePath: p };
    persist(next);
  }, [prefs, persist]);

  const runPreview = useCallback(async () => {
    if (!window.ledboarding?.texturePreview) return;
    if (!sourcePath.trim()) {
      setPreviewError("Kies eerst een bronafbeelding.");
      setPreviewUrl(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    setExportMessage(null);
    try {
      const payload = buildPayload(prefs, sourcePath.trim());
      const res = await window.ledboarding.texturePreview(payload);
      if (!res.ok) {
        setPreviewUrl(null);
        setPreviewError(res.error);
        return;
      }
      setPreviewUrl(res.dataUrl);
    } catch (e) {
      setPreviewUrl(null);
      setPreviewError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  }, [prefs, sourcePath]);

  useEffect(() => {
    if (!isDesktop || !sourcePath.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runPreview();
    }, 480);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [isDesktop, sourcePath, prefs, runPreview]);

  const pickOutputDirectory = useCallback(async () => {
    if (!window.ledboarding?.pickDirectory) return;
    const chosen = await window.ledboarding.pickDirectory(prefs.outputDirectory || prefs.lastExportDirectory);
    if (!chosen) return;
    persist({ ...prefs, outputDirectory: chosen });
  }, [prefs, persist]);

  const openOutputFolder = useCallback(async () => {
    if (!window.ledboarding?.openFolder || !prefs.outputDirectory.trim()) return;
    await window.ledboarding.openFolder(prefs.outputDirectory.trim());
  }, [prefs.outputDirectory]);

  const quickExport = useCallback(async () => {
    if (!window.ledboarding?.textureQuickExportPng) return;
    if (!sourcePath.trim()) {
      setPreviewError("Kies eerst een bronafbeelding.");
      return;
    }
    if (!prefs.outputDirectory.trim()) {
      setExportMessage("Stel eerst een outputmap in.");
      return;
    }
    setExportLoading(true);
    setExportMessage(null);
    setPreviewError(null);
    try {
      const build = buildPayload(prefs, sourcePath.trim());
      const fileName = templateForName(prefs, sourcePath.trim());
      const res = await window.ledboarding.textureQuickExportPng({
        build,
        outputDirectory: prefs.outputDirectory.trim(),
        fileName,
        revealInFolder: false,
      });
      if (!res.ok) {
        setExportMessage(res.error);
        return;
      }
      setExportMessage(`Opgeslagen: ${res.filePath}`);
    } catch (e) {
      setExportMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setExportLoading(false);
    }
  }, [prefs, sourcePath]);

  const batchExport = useCallback(async () => {
    if (!window.ledboarding?.textureSelectSources || !window.ledboarding?.textureBatchExportPng) return;
    if (!prefs.outputDirectory.trim()) {
      setExportMessage("Stel eerst een outputmap in.");
      return;
    }
    const inputs = await window.ledboarding.textureSelectSources();
    if (!inputs || inputs.length === 0) return;
    setBatchLoading(true);
    setBatchRows([]);
    setExportMessage(null);
    setPreviewError(null);
    try {
      const build = buildPayload(prefs, inputs[0]!);
      const filenameTemplateRendered = inputs.map((p) => templateForName(prefs, p));
      const res = await window.ledboarding.textureBatchExportPng({
        build,
        inputPaths: inputs,
        outputDirectory: prefs.outputDirectory.trim(),
        filenameTemplateRendered,
      });
      if (!res.ok) {
        setExportMessage(res.error);
        return;
      }
      setBatchRows(res.results);
      const okCount = res.results.filter((r) => r.ok).length;
      setExportMessage(
        `Batch klaar: ${okCount}/${res.results.length} bestanden opgeslagen in ${res.outputDirectory}`,
      );
    } catch (e) {
      setExportMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBatchLoading(false);
    }
  }, [prefs]);

  const exportPng = useCallback(async () => {
    if (!window.ledboarding?.textureExportPng) return;
    if (!sourcePath.trim()) {
      setExportMessage(null);
      setPreviewError("Kies eerst een bronafbeelding.");
      return;
    }
    setExportLoading(true);
    setExportMessage(null);
    setPreviewError(null);
    try {
      const build = buildPayload(prefs, sourcePath.trim());
      const base = fileNameFromPath(sourcePath).replace(/\.[^.]+$/, "") || "banner";
      const suggestedName = `${base}-${build.canvasWidth}x${build.canvasHeight}.png`;
      const res = await window.ledboarding.textureExportPng({
        build,
        suggestedName,
        defaultDirectory: prefs.lastExportDirectory?.trim() || null,
      });
      if (!res.ok) {
        if (res.canceled) {
          setExportMessage("Opslaan geannuleerd.");
        } else {
          setExportMessage(res.error);
        }
        return;
      }
      const dir = res.filePath.replace(/[/\\][^/\\]+$/, "");
      const next: TextureExportPrefs = {
        ...prefs,
        lastExportDirectory: dir,
      };
      persist(next);
      setExportMessage(`Opgeslagen: ${res.filePath}`);
    } catch (e) {
      setExportMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setExportLoading(false);
    }
  }, [prefs, sourcePath, persist]);

  const validationHint = useMemo(() => {
    if (prefs.stripWidth > prefs.canvasWidth) return "Stripbreedte moet ≤ canvasbreedte.";
    if (prefs.stripHeight > prefs.canvasHeight) return "Striphoogte moet ≤ canvashoogte.";
    return null;
  }, [prefs.stripWidth, prefs.stripHeight, prefs.canvasWidth, prefs.canvasHeight]);

  return (
    <div className="space-y-8">
      <header className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500/90">
              Stap 1 → 2 · Texture voor LED-controller
            </p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white">
              Van sponsorbanner naar één PNG
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Normaliseer een aangeleverde afbeelding of videoframe naar exacte strip-pixels (bv. 1920×72),
              leg die herhaald op een groter canvas (bv. 1920×990) voor de hardware, en sla het PNG-bestand
              op in de map die jullie playout- of LED-workflow gebruikt.
            </p>
          </div>
          {!isDesktop && (
            <span className="rounded-full border border-amber-600/50 bg-amber-950/50 px-3 py-1 text-xs font-medium text-amber-200">
              Alleen in desktop-app
            </span>
          )}
        </div>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { n: "1", t: "Bron", d: "Beeld of video (eerste frame)" },
            { n: "2", t: "Strip", d: "Exacte lint-resolutie" },
            { n: "3", t: "Canvas + tiling", d: "Onder elkaar of verschoven" },
            { n: "4", t: "Outputmap", d: "Vaste map + bestandsnaam-sjabloon" },
            { n: "5", t: "Voorbeeld & export", d: "Snel, batch of save-dialog" },
          ].map((s) => (
            <li
              key={s.n}
              className="flex gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white">
                {s.n}
              </span>
              <div>
                <div className="text-sm font-semibold text-zinc-100">{s.t}</div>
                <div className="text-[11px] text-zinc-500">{s.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </header>

      {!isDesktop && (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-100/90">
          Start <strong className="text-white">ArenaCue LED boarding</strong> via het Windows-programma
          (niet alleen de browser) om texture-export en bestandskiezers te gebruiken.
        </div>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Bronbestand</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Bij <strong className="text-zinc-300">video</strong> wordt het <strong className="text-zinc-300">eerste
          frame</strong> (t = 0) met FFmpeg omgezet naar een raster; daarna dezelfde strip- en
          canvas-pijplijn als bij een foto. Fout formaat (bv. 2100×74) wordt automatisch geschaald naar jouw
          strip (cover = vullen, contain = zwarte randen).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!isDesktop}
            onClick={() => void pickSource()}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Kies afbeelding…
          </button>
          {sourcePath ? (
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-xs text-zinc-300" title={sourcePath}>
                {fileNameFromPath(sourcePath)}
              </div>
              <div className="truncate text-[11px] text-zinc-600" title={sourcePath}>
                {sourcePath}
              </div>
            </div>
          ) : (
            <span className="text-sm text-zinc-500">Nog geen bestand gekozen.</span>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Strip (exact op de lint)</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => persist(applyPerimeterPreset())}
                className="rounded-md border border-zinc-600 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 hover:bg-zinc-800"
              >
                Standaard perimeter (1920×72 → 1920×990)
              </button>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-zinc-500">Breedte (px)</span>
              <input
                type="number"
                min={2}
                max={16384}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
                value={prefs.stripWidth}
                onChange={(e) => persist({ ...prefs, stripWidth: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-500">Hoogte (px)</span>
              <input
                type="number"
                min={2}
                max={16384}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
                value={prefs.stripHeight}
                onChange={(e) => persist({ ...prefs, stripHeight: Number(e.target.value) })}
              />
            </label>
          </div>
          <fieldset className="mt-5">
            <legend className="text-xs font-medium text-zinc-500">Schalen naar strip</legend>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                <input
                  type="radio"
                  name="tex-fit"
                  checked={prefs.fit === "cover"}
                  onChange={() => persist({ ...prefs, fit: "cover" })}
                  className="accent-emerald-500"
                />
                <span>
                  <strong className="text-white">Vullen (cover)</strong> — bijsnijden tot exacte strip
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                <input
                  type="radio"
                  name="tex-fit"
                  checked={prefs.fit === "contain"}
                  onChange={() => persist({ ...prefs, fit: "contain" })}
                  className="accent-emerald-500"
                />
                <span>
                  <strong className="text-white">Passend (contain)</strong> — hele beeld zichtbaar, zwarte
                  rand indien nodig
                </span>
              </label>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
              <span className="font-medium text-zinc-400">Tip:</span> met <strong className="text-zinc-300">Passend</strong> blijft
              het hele bronbeeld zichtbaar in de strip. Een 1920×1080-beeld (16:9) op 1920×72 wordt dus
              proportioneel veel smaller dan 1920 px breed (ongeveer 128×72 px), met zwarte balk links en
              rechts — dat klopt met je voorbeeld. Wil je de strip horizontaal vol laten lopen zonder
              zijbalken, kies <strong className="text-zinc-300">Vullen</strong> — dan wordt boven en onder
              bijgesneden.
            </p>
          </fieldset>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h3 className="text-sm font-semibold text-white">Outputcanvas (totale textuur)</h3>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-zinc-500">Breedte (px)</span>
              <input
                type="number"
                min={2}
                max={16384}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
                value={prefs.canvasWidth}
                onChange={(e) => persist({ ...prefs, canvasWidth: Number(e.target.value) })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-zinc-500">Hoogte (px)</span>
              <input
                type="number"
                min={2}
                max={16384}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
                value={prefs.canvasHeight}
                onChange={(e) => persist({ ...prefs, canvasHeight: Number(e.target.value) })}
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            Meerdere rijen op de texture: zet de <strong className="text-zinc-400">canvashoogte</strong> hoger
            dan de striphoogte (preset gebruikt bv. 990 px bij strip 72 px). Is de canvashoogte gelijk aan
            de striphoogte, dan is er maar één rij — dat is normaal.
          </p>
          <fieldset className="mt-5">
            <legend className="text-xs font-medium text-zinc-500">Herhaling op het canvas</legend>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                <input
                  type="radio"
                  name="tex-layout"
                  checked={prefs.layout === "stacked"}
                  onChange={() => persist({ ...prefs, layout: "stacked" })}
                  className="accent-emerald-500"
                />
                <span>
                  <strong className="text-white">Onder elkaar</strong> — identieke rijen, x = 0 (typisch
                  voor hoek- of segmentlint)
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                <input
                  type="radio"
                  name="tex-layout"
                  checked={prefs.layout === "wrapped"}
                  onChange={() => persist({ ...prefs, layout: "wrapped" })}
                  className="accent-emerald-500"
                />
                <span>
                  <strong className="text-white">Diagonaal verschoven</strong> — elke rij iets naar rechts
                  (modulo)
                </span>
              </label>
            </div>
            {prefs.layout === "wrapped" && (
              <label className="mt-4 block max-w-xs">
                <span className="text-xs font-medium text-zinc-500">Horizontale shift per rij (px)</span>
                <input
                  type="number"
                  min={0}
                  max={16384}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={prefs.wrappedShiftPx}
                  onChange={(e) => persist({ ...prefs, wrappedShiftPx: Number(e.target.value) })}
                />
              </label>
            )}
          </fieldset>
        </section>
      </div>

      {validationHint && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {validationHint}
        </p>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">Voorbeeld</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!isDesktop || previewLoading}
              onClick={() => void runPreview()}
              className="rounded-lg border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-40"
            >
              {previewLoading ? "Bezig…" : "Vernieuwen"}
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Exacte pixels zoals de controller ze krijgt. Bij wijzigingen wordt het voorbeeld automatisch
          ververst (desktop).
        </p>
        <div
          className="relative mt-4 flex max-h-[min(70vh,720px)] min-h-[200px] items-start justify-center overflow-auto rounded-lg border border-zinc-800 bg-[repeating-conic-gradient(#18181b_0%_25%,#0c0c0c_0%_50%)_50%_/_20px_20px] p-4"
          aria-busy={previewLoading}
        >
          {previewLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 text-sm text-white">
              Voorbeeld berekenen…
            </div>
          )}
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Voorbeeld van de geëxporteerde texture"
              className="max-w-full shadow-2xl ring-1 ring-white/10"
            />
          ) : (
            !previewLoading && (
              <span className="text-sm text-zinc-500">
                {isDesktop ? "Nog geen voorbeeld — kies een bron of pas instellingen aan." : "—"}
              </span>
            )
          )}
        </div>
        {previewError && (
          <p className="mt-3 text-sm text-red-400" role="alert">
            {previewError}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-semibold text-white">Outputmap</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Vaste map waar de LED-controller de PNG-bestanden ophaalt (bv.{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5 text-[11px] text-zinc-200">
            C:\Users\BrightBoard\boarding
          </code>
          ). Met &quot;Snel opslaan&quot; en &quot;Batch exporteren&quot; wordt het bestand zonder dialog meteen daar
          geplaatst.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!isDesktop}
            onClick={() => void pickOutputDirectory()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Outputmap kiezen…
          </button>
          <button
            type="button"
            disabled={!isDesktop || !prefs.outputDirectory.trim()}
            onClick={() => void openOutputFolder()}
            className="rounded-lg border border-zinc-600 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Map openen
          </button>
          {prefs.outputDirectory ? (
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-300" title={prefs.outputDirectory}>
              {prefs.outputDirectory}
            </span>
          ) : (
            <span className="text-xs text-zinc-500">Nog geen vaste outputmap. (Save-dialog wordt gebruikt.)</span>
          )}
        </div>
        <label className="mt-4 block max-w-xl">
          <span className="text-xs font-medium text-zinc-500">Bestandsnaam-sjabloon</span>
          <input
            type="text"
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-emerald-500/50"
            value={prefs.filenameTemplate}
            onChange={(e) => persist({ ...prefs, filenameTemplate: e.target.value })}
          />
          <span className="mt-1 block text-[11px] text-zinc-500">
            Tokens: <code className="text-zinc-300">{"{name} {cw} {ch} {sw} {sh} {layout} {fit} {date} {time}"}</code>.
            Voorbeeld nu:{" "}
            <span className="font-mono text-zinc-300">
              {templateForName(prefs, sourcePath || "banner")}
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-semibold text-white">Exporteren</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          <strong className="text-zinc-300">Snel opslaan</strong> schrijft direct in de outputmap met je sjabloon — geen
          dialog. <strong className="text-zinc-300">Batch</strong> verwerkt meerdere banners met dezelfde strip- en
          canvas-instellingen. <strong className="text-zinc-300">Opslaan als…</strong> opent de Windows save-dialog voor
          afwijkende exports.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              !isDesktop ||
              exportLoading ||
              batchLoading ||
              Boolean(validationHint) ||
              !sourcePath.trim() ||
              !prefs.outputDirectory.trim()
            }
            onClick={() => void quickExport()}
            className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            title={
              !prefs.outputDirectory.trim()
                ? "Eerst outputmap instellen"
                : !sourcePath.trim()
                  ? "Eerst bronafbeelding kiezen"
                  : "Opslaan in de outputmap zonder dialog"
            }
          >
            {exportLoading ? "Bezig…" : "Snel opslaan in outputmap"}
          </button>
          <button
            type="button"
            disabled={
              !isDesktop || exportLoading || batchLoading || Boolean(validationHint) || !prefs.outputDirectory.trim()
            }
            onClick={() => void batchExport()}
            className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            title={!prefs.outputDirectory.trim() ? "Eerst outputmap instellen" : "Meerdere bestanden tegelijk verwerken"}
          >
            {batchLoading ? "Batch bezig…" : "Batch exporteren…"}
          </button>
          <button
            type="button"
            disabled={!isDesktop || exportLoading || batchLoading || Boolean(validationHint)}
            onClick={() => void exportPng()}
            className="rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Opslaan als…
          </button>
        </div>
        {exportMessage && (
          <p
            className={`mt-3 text-sm ${
              exportMessage.includes("Opgeslagen") || exportMessage.includes("Batch klaar")
                ? "text-emerald-400"
                : "text-zinc-400"
            }`}
          >
            {exportMessage}
          </p>
        )}
        {batchRows.length > 0 && (
          <ul className="mt-4 max-h-64 space-y-1 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 font-mono text-[11px]">
            {batchRows.map((row, i) => (
              <li
                key={`${row.inputPath}-${i}`}
                className={row.ok ? "text-emerald-300" : "text-red-300"}
                title={row.error || row.filePath}
              >
                {row.ok ? "✓" : "✗"} {fileNameFromPath(row.inputPath)}
                {row.ok && row.filePath ? ` → ${fileNameFromPath(row.filePath)}` : ""}
                {!row.ok && row.error ? ` — ${row.error}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
