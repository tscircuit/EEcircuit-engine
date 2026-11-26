export function renderCascadedStartupSvg({
    lastTimeSeconds,
    errorMessage,
}: {
    lastTimeSeconds: number;
    errorMessage: string;
}): string {
    const complete = lastTimeSeconds >= 100e-6 - 1e-15 && !errorMessage;
    const color = complete ? "#166534" : "#b91c1c";
    const progressX = 80 + Math.min(lastTimeSeconds / 100e-6, 1) * 840;
    const status = `${complete ? "Completed" : "Stopped at"} ${(lastTimeSeconds * 1e6).toFixed(3)} µs of 100.000 µs`;
    const blocks = [
        ["DC source", "24 V"],
        ["LMZM33602", "24 V → 12 V target"],
        ["TPS82130", "12 V → 5 V target"],
        ["TPS82084", "5 V → 1.2 V target"],
    ].map(([part, rails], index) => {
        const x = 40 + index * 245;
        return `<rect x="${x}" y="100" width="205" height="100" rx="8" fill="#f3f4f6" stroke="#9ca3af"/>
<text x="${x + 102.5}" y="140" text-anchor="middle" font-weight="bold">${part}</text>
<text x="${x + 102.5}" y="172" text-anchor="middle">${rails}</text>
${index < 3 ? `<path d="M ${x + 205} 150 h 34 l -7 -5 m 7 5 l -7 5" fill="none" stroke="#374151" stroke-width="2"/>` : ""}`;
    }).join("\n");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500" viewBox="0 0 1000 500">
<rect width="1000" height="500" fill="white"/>
<g font-family="sans-serif" font-size="16" fill="#1f2937">
<text x="500" y="36" text-anchor="middle" font-size="24">Cascaded TI model startup: solver completion</text>
<text x="500" y="68" text-anchor="middle">Input circuit · no external load · LMZM33602 timing resistor: 44.2 kΩ</text>
${blocks}
<text x="500" y="254" text-anchor="middle" font-size="24" fill="${color}">${status}</text>
<path d="M 80 310 H 920" stroke="#d1d5db" stroke-width="12"/>
<path d="M 80 310 H ${progressX.toFixed(3)}" stroke="${color}" stroke-width="12"/>
<circle cx="${progressX.toFixed(3)}" cy="310" r="7" fill="${color}"/>
<text x="80" y="345" text-anchor="middle">0 µs</text>
<text x="920" y="345" text-anchor="middle">100 µs requested</text>
<text x="500" y="390" text-anchor="middle" fill="${color}">${complete ? "The requested transient window completed." : "ngspice reported: Timestep too small"}</text>
<text x="500" y="435" text-anchor="middle">The target voltages describe the circuit; they are not measured results.</text>
<text x="500" y="466" text-anchor="middle">This short window checks convergence, not final output regulation.</text>
</g></svg>\n`;
}
