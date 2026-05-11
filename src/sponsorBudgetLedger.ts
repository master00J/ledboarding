export type SponsorBudgetLedger = {
  startedAtMs: number;
  playedSecBySponsorId: Record<string, number>;
  playCountBySponsorId: Record<string, number>;
};

const STORAGE_KEY = "ledboarding.sponsorBudgetLedger.v1";
export const SPONSOR_BUDGET_LEDGER_EVENT = "ledboarding-sponsor-budget-ledger-update";

function emptyLedger(): SponsorBudgetLedger {
  return {
    startedAtMs: Date.now(),
    playedSecBySponsorId: {},
    playCountBySponsorId: {},
  };
}

function normalizeLedger(raw: unknown): SponsorBudgetLedger {
  if (!raw || typeof raw !== "object") return emptyLedger();
  const rec = raw as Record<string, unknown>;
  const playedRaw =
    rec.playedSecBySponsorId && typeof rec.playedSecBySponsorId === "object" && !Array.isArray(rec.playedSecBySponsorId)
      ? (rec.playedSecBySponsorId as Record<string, unknown>)
      : {};
  const playedSecBySponsorId: Record<string, number> = {};
  for (const [id, value] of Object.entries(playedRaw)) {
    const n = typeof value === "number" ? value : Number(value);
    if (id.trim() && Number.isFinite(n) && n > 0) {
      playedSecBySponsorId[id] = Math.round(n);
    }
  }
  const countRaw =
    rec.playCountBySponsorId && typeof rec.playCountBySponsorId === "object" && !Array.isArray(rec.playCountBySponsorId)
      ? (rec.playCountBySponsorId as Record<string, unknown>)
      : {};
  const playCountBySponsorId: Record<string, number> = {};
  for (const [id, value] of Object.entries(countRaw)) {
    const n = typeof value === "number" ? value : Number(value);
    if (id.trim() && Number.isFinite(n) && n > 0) {
      playCountBySponsorId[id] = Math.round(n);
    }
  }
  const startedAtMs = typeof rec.startedAtMs === "number" && Number.isFinite(rec.startedAtMs)
    ? rec.startedAtMs
    : Date.now();
  return { startedAtMs, playedSecBySponsorId, playCountBySponsorId };
}

export function loadSponsorBudgetLedger(): SponsorBudgetLedger {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeLedger(JSON.parse(raw)) : emptyLedger();
  } catch {
    return emptyLedger();
  }
}

export function saveSponsorBudgetLedger(ledger: SponsorBudgetLedger): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeLedger(ledger)));
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent(SPONSOR_BUDGET_LEDGER_EVENT));
    window.dispatchEvent(new CustomEvent("ledboarding-update"));
    window.ledboarding?.notifyStateChanged();
  });
}

export function addSponsorPlayedSeconds(sponsorId: string, seconds: number): void {
  const id = sponsorId.trim();
  const sec = Math.max(0, Math.round(seconds));
  if (!id || sec <= 0) return;
  const ledger = loadSponsorBudgetLedger();
  saveSponsorBudgetLedger({
    ...ledger,
    playedSecBySponsorId: {
      ...ledger.playedSecBySponsorId,
      [id]: (ledger.playedSecBySponsorId[id] ?? 0) + sec,
    },
    playCountBySponsorId: {
      ...ledger.playCountBySponsorId,
      [id]: (ledger.playCountBySponsorId[id] ?? 0) + 1,
    },
  });
}

export function resetSponsorBudgetLedger(): void {
  saveSponsorBudgetLedger(emptyLedger());
}
