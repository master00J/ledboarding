import type { ReactNode } from "react";

/** Exact pixelcanvas zoals naar de controller verwacht. */
export function LedCanvas({
  widthPx,
  heightPx,
  children,
}: {
  widthPx: number;
  heightPx: number;
  children: ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden bg-black shadow-2xl ring-1 ring-white/10"
      style={{ width: widthPx, height: heightPx }}
    >
      {children}
    </div>
  );
}
