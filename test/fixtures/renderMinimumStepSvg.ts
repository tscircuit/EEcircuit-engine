export function minimumStepOutputVolts(seconds: number): number {
  const onSeconds = 10e-6 + 0.2e-15;
  const offSeconds = 11e-6 + 0.6e-15;
  const activeSeconds = Math.max(0, Math.min(seconds, offSeconds) - onSeconds);
  return -Math.expm1(-activeSeconds / 1e-9) * Math.exp(-Math.max(0, seconds - offSeconds) / 1e-9);
}

export function renderMinimumStepSvg({
  timeSeconds, controlVolts, outputVolts,
}: {
  timeSeconds: number[]; controlVolts: number[]; outputVolts: number[];
}): string {
  const lastSeconds = timeSeconds.at(-1)!;
  const complete = Math.abs(lastSeconds - 12e-6) < 1e-18;
  const points = (volts: number[]) => timeSeconds.flatMap((seconds, index) => {
    const nanoseconds = (seconds - 10e-6) * 1e9;
    const nextNanoseconds = ((timeSeconds[index + 1] ?? seconds) - 10e-6) * 1e9;
    const previousNanoseconds = ((timeSeconds[index - 1] ?? seconds) - 10e-6) * 1e9;
    const visible = (nanoseconds >= -1 && nanoseconds <= 12) ||
      (nanoseconds < -1 && nextNanoseconds >= -1) ||
      (nanoseconds > 12 && previousNanoseconds <= 12);
    return visible ? [`${nanoseconds.toFixed(9)},${volts[index].toFixed(9)}`] : [];
  }).join(" ");
  const expected = Array.from({ length: 401 }, (_, index) => {
    const nanoseconds = -1 + 13 * index / 400;
    return `${nanoseconds.toFixed(9)},${minimumStepOutputVolts(10e-6 + nanoseconds * 1e-9).toFixed(9)}`;
  }).join(" ");
  const panel = ({ y, title, actual, reference }: { y: number; title: string; actual: string; reference?: string }) => `
<text x="80" y="${y - 12}">${title}</text>
<rect x="80" y="${y}" width="840" height="150" fill="none" stroke="#d1d5db"/>
<svg x="80" y="${y}" width="840" height="150" viewBox="-1 -0.1 13 1.2" preserveAspectRatio="none">
<g transform="translate(0 1) scale(1 -1)">
${reference ? `<polyline points="${reference}" fill="none" stroke="#6b7280" stroke-dasharray="6 4" stroke-width="2" vector-effect="non-scaling-stroke"/>` : ""}
<polyline points="${actual}" fill="none" stroke="#2563eb" stroke-width="2" vector-effect="non-scaling-stroke"/>
</g></svg>
<text x="65" y="${y + 25}" text-anchor="end">1 V</text><text x="65" y="${y + 140}" text-anchor="end">0 V</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="620" viewBox="0 0 1000 620">
<rect width="1000" height="620" fill="white"/>
<g font-family="sans-serif" font-size="15" fill="#1f2937">
<text x="500" y="30" text-anchor="middle" font-size="21">Local error control at a comparator edge</text>
<text x="500" y="58" text-anchor="middle">Pulse → 0.5 V comparator → 1 Ω resistor → 1 nF capacitor</text>
<text x="500" y="84" text-anchor="middle">Same circuit and tolerances; the solver requests a smaller step.</text>
${panel({ y: 125, title: "Input control voltage · dashed: requested pulse", actual: points(controlVolts), reference: "-1,0 0,0 0.0000004,1 12,1" })}
${panel({ y: 325, title: "Capacitor output · blue: engine · dashed: exact RC response", actual: points(outputVolts), reference: expected })}
<text x="80" y="500" text-anchor="middle">−1</text><text x="403" y="500" text-anchor="middle">4</text><text x="662" y="500" text-anchor="middle">8</text><text x="920" y="500" text-anchor="middle">12</text>
<text x="500" y="530" text-anchor="middle">Time after the rising edge (ns)</text>
<text x="500" y="570" text-anchor="middle" fill="${complete ? "#166534" : "#b91c1c"}">${complete ? "Completed" : "Stopped at"} ${(lastSeconds * 1e6).toFixed(6)} µs / requested 12 µs</text>
<text x="500" y="598" text-anchor="middle">${complete ? "The smaller step passed convergence and local error checks." : "Timestep too small: the heuristic minimum rejected the requested step."}</text>
</g></svg>\n`;
}
