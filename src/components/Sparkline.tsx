interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}

export function Sparkline({ data, width = 100, height = 30, color = "#38bdf8", fill = true }: SparklineProps) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="flex items-center justify-center text-xs text-slate-600">—</div>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  const path = `M ${points.join(" L ")}`;
  const areaPath = `${path} L ${width},${height} L 0,${height} Z`;
  const gradientId = `spark-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradientId})`} />
        </>
      )}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
