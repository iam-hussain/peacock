// Lightweight area+line chart (no chart lib) for the portfolio trend. Pure SVG, server-rendered.
export function PortfolioChart({
  data,
  height = 150,
  gradientId = "pgGrad",
}: {
  data: number[];
  height?: number;
  gradientId?: string;
}) {
  const W = 560;
  const H = 150;
  const pad = 8;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - pad - ((v - min) / range) * (H - 2 * pad);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${W} ${H} L0 ${H} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--teal)" stopOpacity="0.18" />
          <stop offset="1" stopColor="var(--teal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke="var(--teal)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
