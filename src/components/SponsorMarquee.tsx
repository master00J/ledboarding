import type { LedZone } from "@/types";

const DEMO_SPONSORS = [
  "ArenaCue LED",
  "Sound & Vision",
  "Partner A",
  "Partner B",
  "Welkom in het stadion",
];

export function SponsorMarquee({ zone }: { zone: LedZone }) {
  const segment = [...DEMO_SPONSORS, "•"];
  const fontSize = Math.max(14, Math.round(zone.heightPx * 0.28));
  const gap = Math.round(fontSize * 2);

  const strip = (suffix: string) =>
    segment.map((label, i) => (
      <span
        key={`${suffix}-${label}-${i}`}
        className="inline-flex shrink-0 items-center font-semibold tracking-wide text-white"
        style={{ fontSize }}
      >
        {label}
      </span>
    ));

  return (
    <div
      className="flex h-full w-full items-center overflow-hidden bg-zinc-900"
      style={{ paddingInline: Math.round(zone.heightPx * 0.08) }}
    >
      <div className="marquee-track flex w-max shrink-0 whitespace-nowrap">
        <div className="flex shrink-0" style={{ gap }}>
          {strip("a")}
        </div>
        <div className="flex shrink-0" style={{ gap }}>
          {strip("b")}
        </div>
      </div>
      <style>{`
        @keyframes marquee-x {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marquee-track {
          animation: marquee-x 45s linear infinite;
        }
      `}</style>
    </div>
  );
}
