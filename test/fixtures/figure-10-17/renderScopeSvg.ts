import path from "node:path";

type Row = number[];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseWrdata(datText: string): Row[] {
  return datText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/).map(Number))
    .filter((row) => row.length >= 18 && row.every(Number.isFinite));
}

export function renderFigure1017ScopeSvg(datText: string, datFileName: string): string {
  const rows = parseWrdata(datText);
  if (rows.length === 0) {
    throw new Error("No plottable figure 10-17 wrdata rows found");
  }

  const width = 1260;
  const height = 650;
  const plot = { x: 74, y: 34, width: 968, height: 562 };
  const divY = plot.height / 8;
  const windowSeconds = 18e-6;
  const endPaddingSeconds = 1e-6;
  const maxTime = rows.reduce((max, row) => Math.max(max, row[0] ?? max), Number.NEGATIVE_INFINITY);
  const startTime = Math.max(0, maxTime - endPaddingSeconds - windowSeconds);

  const traces = [
    {
      label: "Vo",
      color: "#2563eb",
      yColumn: 3,
      baseline: 114.79,
      valueAtBaseline: 3.3,
      valuePerDiv: 0.05,
      legend: "Vo: 50 mV/div, offset 3.3 V",
    },
    {
      label: "L1",
      color: "#10b981",
      yColumn: 7,
      baseline: 251.0,
      valueAtBaseline: 0,
      valuePerDiv: 3,
      legend: "L1: 3 V/div",
    },
    {
      label: "L2",
      color: "#d97706",
      yColumn: 9,
      baseline: 346.5,
      valueAtBaseline: 0,
      valuePerDiv: 3,
      legend: "L2: 3 V/div",
    },
    {
      label: "IL",
      color: "#d946ef",
      yColumn: 11,
      baseline: 525.75,
      valueAtBaseline: 0,
      valuePerDiv: 0.5,
      legend: "IL: 500 mA/div",
    },
  ];

  function xScale(seconds: number): number {
    return plot.x + ((seconds - startTime) / windowSeconds) * plot.width;
  }

  function yScale(value: number, trace: (typeof traces)[number]): number {
    return trace.baseline - ((value - trace.valueAtBaseline) / trace.valuePerDiv) * divY;
  }

  function pointList(yColumn: number, trace: (typeof traces)[number]): string {
    const selected = rows.filter((row) => {
      const time = row[yColumn - 1] ?? row[0];
      return time >= startTime && time <= startTime + windowSeconds && Number.isFinite(row[yColumn]);
    });
    const stride = Math.max(1, Math.ceil(selected.length / 9000));

    const points: string[] = [];
    for (let index = 0; index < selected.length; index += stride) {
      const row = selected[index];
      points.push(`${xScale(row[yColumn - 1] ?? row[0]).toFixed(2)},${yScale(row[yColumn], trace).toFixed(2)}`);
    }

    const last = selected[selected.length - 1];
    if (last && selected.length > 0 && (selected.length - 1) % stride !== 0) {
      points.push(`${xScale(last[yColumn - 1] ?? last[0]).toFixed(2)},${yScale(last[yColumn], trace).toFixed(2)}`);
    }

    return points.join(" ");
  }

  const verticalGrid = Array.from({ length: 11 }, (_, index) => {
    const x = plot.x + (plot.width * index) / 10;
    const stroke = index === 0 ? "#bdbdbd" : "#d9d9d9";
    return `<line x1="${x.toFixed(2)}" x2="${x.toFixed(2)}" y1="${plot.y}" y2="${plot.y + plot.height}" stroke="${stroke}"/>`;
  }).join("\n  ");

  const horizontalGrid = Array.from({ length: 9 }, (_, index) => {
    const y = plot.y + divY * index;
    const stroke = index === 0 ? "#bdbdbd" : "#d9d9d9";
    return `<line x1="${plot.x}" x2="${plot.x + plot.width}" y1="${y.toFixed(2)}" y2="${y.toFixed(2)}" stroke="${stroke}"/>`;
  }).join("\n  ");

  const xLabels = Array.from({ length: 6 }, (_, index) => {
    const x = plot.x + (plot.width * index) / 5;
    const value = (18 * index) / 5;
    return `<text x="${x.toFixed(2)}" y="620" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#404040">${value.toFixed(1)}</text>`;
  }).join("\n  ");

  const traceSvg = traces.map((trace) => {
    const points = pointList(trace.yColumn, trace);
    return [
      `<line x1="60" x2="${plot.x}" y1="${trace.baseline.toFixed(2)}" y2="${trace.baseline.toFixed(2)}" stroke="${trace.color}" stroke-width="2"/>`,
      `<text x="56" y="${(trace.baseline + 4).toFixed(2)}" text-anchor="end" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="${trace.color}">${trace.label}</text>`,
      `<polyline points="${points}" fill="none" stroke="${trace.color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>`,
    ].join("\n  ");
  }).join("\n  ");

  const legend = traces.map((trace, index) =>
    `<text x="1060" y="${64 + index * 22}" fill="${trace.color}">${trace.legend}</text>`
  ).join("\n    ");

  const title = `${path.basename(datFileName, ".dat")}  |  VI=4.2 V  VO=3.3 V  MODE=Low  IO=40 mA`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#fff"/>
  <text x="74" y="23" font-family="Arial, sans-serif" font-size="17" font-weight="700">${escapeXml(title)}</text>
  <rect x="${plot.x}" y="${plot.y}" width="${plot.width}" height="${plot.height}" fill="#fbfbfb" stroke="#bdbdbd"/>
  ${verticalGrid}
  ${horizontalGrid}
  ${xLabels}
  ${traceSvg}
  <text x="558" y="633" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" fill="#262626">time (us)</text>
  <g font-family="Arial, sans-serif" font-size="12" fill="#404040">
    ${legend}
  </g>
</svg>
`;
}
