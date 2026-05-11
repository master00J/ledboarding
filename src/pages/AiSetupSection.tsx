import { type FormEvent, useEffect, useState } from "react";
import {
  askLedAiSetupAssistant,
  type LedAiAction,
  type LedAiChatMessage,
} from "@/aiSetupAssistant";
import { applyLedAiActions, describeLedAiAction } from "@/ledAiActions";

const WELCOME: LedAiChatMessage = {
  role: "assistant",
  content:
    "Hoi, ik help je met LED boarding. Je kunt vragen hoe de software werkt, of je schermen, zones en playlists laten voorstellen.",
};

const STORAGE_KEY = "ledboarding.aiSetupAssistant.v1";

const EXAMPLES = [
  "Leg uit wat het verschil is tussen outputs, zones, regions en segmenten.",
  "Hoe werkt de Playout Console met perimeter en mid-tier playlists?",
  "Hoe importeer ik media veilig voor een wedstrijddag?",
  "Maak een basisopstelling met perimeter en mid-tier playlist, elk 15 seconden per sponsor.",
  "Zet de brightness op 85% en maak segmenten voor wedstrijd, rust en na goal.",
  "Maak twee zones: Perimeter 4992x320 en Mid-tier 1920x256.",
];

type AiSetupState = {
  messages: LedAiChatMessage[];
  input: string;
  busy: boolean;
  pendingActions: LedAiAction[];
  status: string;
};

const DEFAULT_STATE: AiSetupState = {
  messages: [WELCOME],
  input: "",
  busy: false,
  pendingActions: [],
  status: "",
};

let activeController: AbortController | null = null;
let activeRequestId = 0;
let aiSetupState = loadInitialState();
const listeners = new Set<(state: AiSetupState) => void>();

function subscribe(listener: (state: AiSetupState) => void): () => void {
  listeners.add(listener);
  listener(aiSetupState);
  return () => listeners.delete(listener);
}

function setAiSetupState(updater: (state: AiSetupState) => AiSetupState) {
  aiSetupState = updater(aiSetupState);
  saveStoredState(aiSetupState);
  for (const listener of listeners) listener(aiSetupState);
}

export function AiSetupSection() {
  const [state, setState] = useState<AiSetupState>(aiSetupState);
  const { messages, input, busy, pendingActions, status } = state;

  useEffect(() => subscribe(setState), []);

  async function submitMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || aiSetupState.busy) return;
    const requestId = activeRequestId + 1;
    activeRequestId = requestId;
    const nextMessages: LedAiChatMessage[] = [
      ...conversationWithoutWelcome(aiSetupState.messages),
      { role: "user", content: trimmed },
    ];
    setAiSetupState((prev) => ({
      ...prev,
      messages: [...prev.messages, { role: "user", content: trimmed }],
      input: "",
      busy: true,
      status: "",
      pendingActions: [],
    }));

    const controller = new AbortController();
    activeController = controller;
    try {
      const answer = await askLedAiSetupAssistant(nextMessages, controller.signal);
      if (requestId !== activeRequestId) return;
      const assistantMessage =
        answer.actions.length > 0
          ? `${answer.message}\n\nLet op: ik heb dit nog niet toegepast. Controleer de voorstellen rechts en klik op "Wijzigingen toepassen" om de lokale setup echt te wijzigen.`
          : answer.message;
      setAiSetupState((prev) => ({
        ...prev,
        messages: [...prev.messages, { role: "assistant", content: assistantMessage }],
        pendingActions: answer.actions,
        status:
          answer.actions.length > 0
            ? `${answer.actions.length} voorstel(len) klaar. Nog niet toegepast.`
            : "Geen automatische wijzigingen voorgesteld. Volg de stappen uit het antwoord.",
      }));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (requestId !== activeRequestId) return;
      const message = err instanceof Error ? err.message : "AI setupassistent is niet bereikbaar.";
      setAiSetupState((prev) => ({
        ...prev,
        messages: [...prev.messages, { role: "assistant", content: message }],
        status: message,
      }));
    } finally {
      if (requestId === activeRequestId) {
        setAiSetupState((prev) => ({ ...prev, busy: false }));
        activeController = null;
      }
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void submitMessage(input);
  }

  function reset() {
    activeRequestId += 1;
    activeController?.abort();
    activeController = null;
    setAiSetupState(() => DEFAULT_STATE);
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
    setAiSetupState((prev) => ({
      ...prev,
      pendingActions: [],
      status: summary || "Geen wijzigingen toegepast.",
      messages: [
        ...prev.messages,
        {
          role: "assistant",
          content:
            result.skipped.length > 0
              ? `${summary}\n\nOvergeslagen:\n${result.skipped.map((item) => `- ${item}`).join("\n")}`
              : summary || "Geen wijzigingen toegepast.",
        },
      ],
    }));
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">
              AI setupassistent
            </p>
            <h2 className="mt-1 text-2xl font-black text-white">Vraag uitleg of laat je setup voorstellen</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              De AI kan uitleggen hoe LED boarding werkt en leest een compacte snapshot van je lokale zones,
              segmenten en playlists. Voorstellen worden pas toegepast nadat jij bevestigt.
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
                AI denkt mee...
              </div>
            ) : null}
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <textarea
            value={input}
            onChange={(event) => setAiSetupState((prev) => ({ ...prev, input: event.target.value }))}
            rows={3}
            placeholder="Vraag hoe iets werkt, of laat een perimeter/mid-tier setup voorstellen..."
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
              Hier verschijnen veilige acties zodra de AI een configureerbaar voorstel maakt. Bij uitlegvragen blijft
              dit leeg.
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
                onClick={() => setAiSetupState((prev) => ({ ...prev, input: example }))}
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

function conversationWithoutWelcome(messages: LedAiChatMessage[]): LedAiChatMessage[] {
  return messages.filter((message, index) => {
    if (index !== 0) return true;
    return message.role !== WELCOME.role || message.content !== WELCOME.content;
  });
}

function loadInitialState(): AiSetupState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<AiSetupState>;
    const messages = normalizeMessages(parsed.messages);
    const pendingActions = Array.isArray(parsed.pendingActions)
      ? parsed.pendingActions.filter(isLedAiAction).slice(0, 10)
      : [];
    return {
      messages: messages.length > 0 ? messages : [WELCOME],
      input: typeof parsed.input === "string" ? parsed.input : "",
      busy: false,
      pendingActions,
      status: typeof parsed.status === "string" ? parsed.status : "",
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveStoredState(state: AiSetupState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        messages: state.messages.slice(-40),
        input: state.input,
        pendingActions: state.pendingActions,
        status: state.status,
      }),
    );
  } catch {
    /* ignore */
  }
}

function normalizeMessages(value: unknown): LedAiChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
      return { role, content: content.slice(0, 4000) };
    })
    .filter((item): item is LedAiChatMessage => Boolean(item))
    .slice(-40);
}

function isLedAiAction(value: unknown): value is LedAiAction {
  if (!value || typeof value !== "object") return false;
  const action = value as { type?: unknown; label?: unknown; payload?: unknown };
  return typeof action.type === "string" && typeof action.label === "string" && typeof action.payload === "object";
}
