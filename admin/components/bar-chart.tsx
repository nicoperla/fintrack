/** A small bar chart in SVG, one bar per point; each bar has a tooltip with its value. */
export function BarChart({
  points,
  label,
  format = (value) => String(value),
}: {
  points: { day: string; value: number }[];
  label: string;
  format?: (value: number) => string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const width = 600;
  const height = 140;
  const gap = 3;
  const barWidth = (width - gap * (points.length - 1)) / points.length;
  const dayLabel = (day: string) => {
    const [, month, date] = day.split("-");
    return `${Number(date)}/${Number(month)}`;
  };

  return (
    <figure className="grid gap-2">
      <svg
        viewBox={`0 0 ${width} ${height + 18}`}
        role="img"
        aria-label={label}
        className="h-auto w-full"
      >
        <line x1={0} x2={width} y1={height} y2={height} className="stroke-line" />
        {points.map((point, i) => {
          const h = point.value === 0 ? 2 : Math.max(4, (point.value / max) * (height - 8));
          const x = i * (barWidth + gap);
          return (
            <g key={point.day}>
              <rect
                x={x}
                y={height - h}
                width={barWidth}
                height={h}
                rx={2}
                className={point.value === 0 ? "fill-line" : "fill-accent"}
              >
                <title>{`${dayLabel(point.day)}: ${format(point.value)}`}</title>
              </rect>
              {(i === 0 || i === points.length - 1 || i % 7 === 0) && (
                <text
                  x={x + barWidth / 2}
                  y={height + 14}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px]"
                >
                  {dayLabel(point.day)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-muted text-xs">
        Massimo {format(max)} in un giorno · totale{" "}
        {format(points.reduce((sum, p) => sum + p.value, 0))}
      </figcaption>
    </figure>
  );
}
