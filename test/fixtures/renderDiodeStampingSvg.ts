// Independent diode equation, including Gmin and the series resistance:
// 1 µA = Is * expm1(Vj / (n * Vt)) + Gmin * Vj; Vnode = Vj + I * Rs.
export const diodeEquilibriumVolts = 0.023822732507510925;

export function renderDiodeStampingSvg({
  timeSeconds, nodeVolts, referenceVolts, comparatorVolts,
}: {
  timeSeconds: number[]; nodeVolts: number[]; referenceVolts: number[]; comparatorVolts: number[];
}): string {
  const lastSeconds = timeSeconds.at(-1)!;
  const complete = Math.abs(lastSeconds - 2e-9) < 1e-20;
  const count = timeSeconds.length;
  const inputPoints = nodeVolts.map((volts, index) =>
    `${(index / Math.max(1, count - 1) * 840).toFixed(3)},${(200 - (volts - diodeEquilibriumVolts) * 1e12 * 170).toFixed(6)}`).join(" ");
  const outputPoints = comparatorVolts.map((volts, index) =>
    `${(index / Math.max(1, count - 1) * 840).toFixed(3)},${(70 - volts * 55).toFixed(3)}`).join(" ");
  const threshold = (referenceVolts[0] - diodeEquilibriumVolts) * 1e12;
  const maximumError = Math.max(...nodeVolts.map((volts) => Math.abs(volts - diodeEquilibriumVolts))) * 1e12;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650" viewBox="0 0 1000 650">
<rect width="1000" height="650" fill="white"/>
<g font-family="sans-serif" font-size="15" fill="#1f2937">
<text x="500" y="30" text-anchor="middle" font-size="21">A steady diode input must not make the comparator chatter</text>
<text x="500" y="58" text-anchor="middle">1 µA DC → D1 (Is = 100 pA, n = 0.1, Rs = 5 mΩ) → comparator</text>
<text x="500" y="84" text-anchor="middle">Physical diode voltage: 23.822732507510926 mV · comparator reference: 10 fV higher</text>
<text x="80" y="120">Comparator input: error from the physical diode voltage (pV)</text>
<rect x="80" y="140" width="840" height="340" fill="none" stroke="#d1d5db"/>
<g transform="translate(80 140)">
<line x1="0" y1="200" x2="840" y2="200" stroke="#6b7280" stroke-dasharray="6 4"/>
<line x1="0" y1="${(200 - threshold * 170).toFixed(6)}" x2="840" y2="${(200 - threshold * 170).toFixed(6)}" stroke="#dc2626" stroke-dasharray="3 3"/>
<polyline points="${inputPoints}" fill="none" stroke="#2563eb" stroke-width="2"/>
</g>
<text x="65" y="178" text-anchor="end">+1</text><text x="65" y="345" text-anchor="end">0</text><text x="65" y="478" text-anchor="end">−0.8</text>
<text x="500" y="497" text-anchor="middle" font-size="13">Accepted transient samples (0–${count - 1}) · blue: engine · red: comparator threshold</text>
<text x="80" y="510">Comparator output (V) · expected: 0 V</text>
<rect x="80" y="525" width="840" height="80" fill="none" stroke="#d1d5db"/>
<polyline transform="translate(80 525)" points="${outputPoints}" fill="none" stroke="#2563eb" stroke-width="2"/>
<text x="65" y="545" text-anchor="end">1</text><text x="65" y="600" text-anchor="end">0</text>
<text x="500" y="630" text-anchor="middle" fill="${complete ? "#166534" : "#b91c1c"}">${complete ? "Completed" : "Stopped at"} ${(lastSeconds * 1e12).toFixed(6)} ps / 2000 ps · max input error ${maximumError.toFixed(6)} pV · ${count} accepted samples</text>
</g></svg>\n`;
}
