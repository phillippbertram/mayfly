import { motion } from "motion/react";
import { useMemo } from "react";
import { finderOrigins, qrMatrix } from "../../lib/qr";

/** Crisp SVG QR code with rounded finder eyes. Always dark ink on the white card. */
export function QrCode({ text, size }: { text: string; size: number }) {
  const { n, path } = useMemo(() => {
    const { size: n, modules } = qrMatrix(text);
    return { n, path: modules.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join("") };
  }, [text]);

  return (
    <motion.svg
      role="img"
      aria-label="QR code for this share's link"
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      initial={{ clipPath: "circle(0% at 50% 50%)", opacity: 0.6, scale: 0.94 }}
      animate={{ clipPath: "circle(75% at 50% 50%)", opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="block"
    >
      <path d={path} fill="var(--qr-ink)" shapeRendering="crispEdges" />
      {finderOrigins(n).map(([x, y]) => (
        <g key={`${x}-${y}`} fill="var(--qr-ink)">
          <path
            fillRule="evenodd"
            d={`M${x + 2} ${y}h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2zM${x + 2.4} ${y + 1}h2.2a1.4 1.4 0 0 1 1.4 1.4v2.2a1.4 1.4 0 0 1-1.4 1.4h-2.2a1.4 1.4 0 0 1-1.4-1.4v-2.2a1.4 1.4 0 0 1 1.4-1.4z`}
          />
          <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.9} />
        </g>
      ))}
    </motion.svg>
  );
}
