import { useMemo } from "react";
import { encode } from "uqr";

// Plain SVG QR code. Dark modules on a light quiet zone so phones read it on any TV picture.
export function QrCode({ text, className }: { text: string; className?: string }) {
  const path = useMemo(() => {
    const { data } = encode(text, { border: 2 });
    let d = "";
    data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { d, size: data.length };
  }, [text]);

  return (
    <svg className={className} viewBox={`0 0 ${path.size} ${path.size}`} shapeRendering="crispEdges" aria-hidden>
      <rect className="tv-qr-bg" width={path.size} height={path.size} />
      <path className="tv-qr-fg" d={path.d} />
    </svg>
  );
}
