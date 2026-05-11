import { type FormEvent, useMemo, useRef, useState } from "react";
import {
  askLedAiSetupAssistant,
  type LedAiAction,
  type LedAiChatMessage,
} from "@/aiSetupAssistant";
import { applyLedAiActions, describeLedAiAction } from "@/ledAiActions";

const WELCOME: LedAiChatMessage = {
  role: "assistant",
  content:
    "Hoi, ik help je met de LED boarding setup. Beschrijf je schermen, zones of gewenste playlist en ik maak een voorstel dat je eerst kunt controleren.",
};

const EXAMPLES = [
  "Maak een basisopstelling met perimeter en mid-tier playlist, elk 15 seconden per sponsor.",
  "Zet de brightness op 85% en maak segmenten voor wedstrijd, rust en na goal.",
  "Maak twee zones: Perimeter 4992x320 en Mid-tier 1920x256.",
];

export function AiSetupSection() {
  const [messages, setMessages] = useState<LedAiChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingActions, setPendingActions] = useState<LedAiAction[]>([]);
  const [status, setStatus] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const conversation = useMemo(
    () => messages.filter((message) => message !== WELCOME),
    [messages],
  );

  async function submitMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const nextMessages: LedAiChatMessage[] = [...conversation, { role: "user", content: trimmed }];
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setBusy(true);
    setStatus("");
    setPendingActions([]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const answer = await askLedAiSetupAssistant(nextMessages, controller.signal);
      setMessages((prev) => [...prev, { role: "assistant", content: answer.message }]);
      setPendingActions(answer.actions);
      if (answer.actions.length === 0) {
        setStatus("Geen automatische wijzigingen voorgesteld. Volg de stappen uit het antwoord.");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "AI setupassistent is niet bereikbaar.";
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
      setStatus(message);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submitMessage(input);
  }

  function reset() {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([WELCOME]);
    setInput("");
    setPendingActions([]);
    setStatus("");
    setBusy(false);
  }

  function applyActions() {
    if (pendingActions.length === 0) return;
    const ok = window.confirm(
      `${pendingActions.length} AI-voorstel(len) toepassen op deze lokale LED boarding setup?`,
    );
    if (!ok) return;
    const result = applyLedAiActions(pendingActions);
    const summary = [
      result.applied.length > 0 ? `${result.applied.length} wijziging(en) toegepast.` : "",
      result.skipped.length > 0 ? `${result.skipped.length} voorstel(len) overgeslagen.` : "",
    ].filter(Boolean).join(" ");
    setPendingActions([]);
    setStatus(summary || "Geen wijzigingen toegepast.");
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content:
          result.skipped.length > 0
            ? `${summary}\n\nOvergeslagen:\n${result.skipped.map((item) => `- ${item}`).join("\n")}`
            : summary || "Geen wijzigingen toegepast.",
      },
    ]);
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">
              AI setupassistent
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">Laat ArenaCue je setup voorstellen</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              De AI leest een compacte snapshot van je lokale zones, segmenten en playlists. Voorstellen worden pas
              toegepast nadat jij bevestigt.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900"
          >
            Nieuwe chat
          </button>
        </div>

        <div className="h-[420px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "ml-auto bg-emerald-600 text-white"
                    : "bg-zinc-950 text-zinc-200"
                }`}
              >
                {message.content}
              </div>
            ))}
            {busy ? (
              <div className="max-w-[88%] rounded-xl bg-zinc-950 px-3 py-2 text-sm text-zinc-400">
                AI denkt mee over je setup...
              </div>
            ) : null}
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            placeholder="Bijv. maak een perimeter en mid-tier playlist met 15 seconden per sponsor..."
            className="min-h-20 flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-emerald-500/50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="w-28 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black uppercase text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Vraag
          </button>
        </form>

        {status ? <p className="mt-3 text-sm text-zinc-400">{status}</p> : null}
      </div>

      <aside className="min-w-0 space-y-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-400">Voorstellen</h3>
          {pendingActions.length > 0 ? (
            <>
              <div className="mt-3 space-y-2">
                {pendingActions.map((action, index) => (
                  <div key={`${action.type}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="truncate text-sm font-semibold text-white" title={action.label}>
                      {action.label}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{describeLedAiAction(action)}</div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={applyActions}
                className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black uppercase text-white hover:bg-emerald-500"
              >
                Wijzigingen toepassen
              </button>
            </>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              Hier verschijnen veilige acties zodra de AI een configureerbaar voorstel maakt.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <h3 className="text-sm font-black uppercase tracking-[0.18em] text-zinc-400">Voorbeelden</h3>
          <div className="mt-3 space-y-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setInput(example)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-left text-xs text-zinc-300 hover:border-emerald-500/60"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
