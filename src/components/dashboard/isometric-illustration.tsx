/**
 * The Up Next card's illustration: an isometric plinth with three rising bar
 * blocks and a flagged peak — growth, structured. Pure SVG so it themes with
 * currentColor-free fills and costs nothing to load.
 */

type Block = { x: number; y: number; h: number; top: string; left: string; right: string };

// Isometric unit vectors: right-down (26, 15) and left-down (-26, 15).
function blockPath({ x, y, h }: Block) {
  const w = 26;
  const d = 15;
  return {
    top: `M${x},${y - h} l${w},${d} l${-w},${d} l${-w},${-d} Z`,
    left: `M${x - w},${y - h + d} l${w},${d} v${h} l${-w},${-d} Z`,
    right: `M${x},${y - h + 2 * d} l${w},${-d} v${h} l${-w},${d} Z`,
  };
}

const BLOCKS: Block[] = [
  { x: 74, y: 104, h: 22, top: "#bfdbfe", left: "#60a5fa", right: "#3b82f6" },
  { x: 112, y: 92, h: 42, top: "#93c5fd", left: "#3b82f6", right: "#2563eb" },
  { x: 150, y: 80, h: 66, top: "#fdba74", left: "#f97316", right: "#ea580c" },
];

export function IsometricIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 170" className={className} role="img" aria-label="Isometric illustration of rising business metrics">
      {/* Plinth */}
      <path d="M110,58 l92,53 l-92,53 l-92,-53 Z" className="fill-[#eff6ff] dark:fill-[#172554]" />
      <path d="M18,111 l92,53 v6 l-92,-53 Z" className="fill-[#dbeafe] dark:fill-[#1e3a8a]" />
      <path d="M110,164 l92,-53 v6 l-92,53 Z" className="fill-[#bfdbfe] dark:fill-[#1e40af]" />
      {/* Grid lines on the plinth */}
      {[0.25, 0.5, 0.75].map((t) => (
        <path
          key={t}
          d={`M${18 + 92 * t},${111 - 53 * t} l92,53`}
          className="stroke-[#bfdbfe] dark:stroke-[#1e40af]"
          strokeWidth="0.8"
          fill="none"
        />
      ))}
      {BLOCKS.map((block) => {
        const p = blockPath(block);
        return (
          <g key={block.x}>
            <path d={p.left} fill={block.left} />
            <path d={p.right} fill={block.right} />
            <path d={p.top} fill={block.top} />
          </g>
        );
      })}
      {/* Flag on the tallest block */}
      <path d="M150,29 v-24" stroke="#c2410c" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M150,5 l16,5 l-16,5 Z" fill="#f97316" />
      {/* Trend line */}
      <path
        d="M48,128 C80,118 96,96 118,84 S150,52 176,44"
        fill="none"
        stroke="#1d4ed8"
        strokeWidth="1.6"
        strokeDasharray="3 3"
        strokeLinecap="round"
      />
      <circle cx="176" cy="44" r="3" fill="#1d4ed8" />
    </svg>
  );
}
