type RetryTrace = {
    timeSeconds: number[];
    inputVolts: number[];
    nodeVolts: number[];
};

function renderTrace({ timeSeconds, volts, minimumVolts, maximumVolts, top, color }: {
    timeSeconds: number[]; volts: number[]; minimumVolts: number;
    maximumVolts: number; top: number; color: string;
}): string {
    const points = timeSeconds.flatMap((seconds, index) => seconds <= 0.025
        ? [`${(80 + seconds / 0.025 * 840).toFixed(3)},${(top + 110 - (volts[index] - minimumVolts) / (maximumVolts - minimumVolts) * 110).toFixed(3)}`]
        : []).join(" ");
    return `<rect x="80" y="${top}" width="840" height="110" fill="none" stroke="#d1d5db"/>
<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2"/>
<text x="68" y="${top + 6}" text-anchor="end">${maximumVolts.toFixed(0)}</text>
<text x="68" y="${top + 110}" text-anchor="end">${minimumVolts.toFixed(0)}</text>`;
}

export function renderAcceptedTransientRetrySvg({ timeSeconds, inputVolts, nodeVolts }: RetryTrace): string {
    const stopSeconds = timeSeconds.at(-1)!;
    const complete = Math.abs(stopSeconds - 2) < 1e-12;
    const nodeMinimumVolts = Math.floor(Math.min(0, ...nodeVolts) / 10) * 10;
    const nodeMaximumVolts = Math.ceil(Math.max(10, ...nodeVolts) / 10) * 10;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800" viewBox="0 0 1000 800">
<rect width="1000" height="800" fill="white"/>
<g font-family="sans-serif" font-size="15" fill="#1f2937">
<text x="500" y="32" text-anchor="middle" font-size="22">A failed Newton guess must not poison every retry</text>
<text x="500" y="62" text-anchor="middle">Same amplifier, component values, Gear method and 2 s transient</text>
<rect x="45" y="105" width="200" height="115" rx="8" fill="#eff6ff" stroke="#2563eb"/>
<text x="145" y="137" text-anchor="middle">Drive at n31</text>
<text x="145" y="167" text-anchor="middle">12 V peak · 200 Hz</text>
<text x="145" y="197" text-anchor="middle">V_Dn31 sinusoid</text>
<path d="M245 160H290m-8-5 8 5-8 5" fill="none" stroke="#1f2937" stroke-width="2"/>
<rect x="290" y="105" width="235" height="115" rx="8" fill="#f9fafb" stroke="#6b7280"/>
<text x="407" y="137" text-anchor="middle">Nonlinear triode network</text>
<text x="407" y="167" text-anchor="middle">B-source models + RC</text>
<text x="407" y="197" text-anchor="middle">460 V / −38 V supplies</text>
<text x="755" y="100" text-anchor="middle">Measured RC branch</text>
<path d="M580 135H660m8-18v36m8-36v36m0-18H845V210H790" fill="none" stroke="#1f2937" stroke-width="2"/>
<text x="580" y="125">n7</text><text x="700" y="125">C17 · 100 nF</text>
<path d="M580 210H660m80 0h50" fill="none" stroke="#1f2937" stroke-width="2"/>
<rect x="660" y="201" width="80" height="18" fill="white" stroke="#1f2937" stroke-width="2"/>
<text x="580" y="200">n39</text><text x="700" y="243" text-anchor="middle">R30 · 22 kΩ</text>
<circle cx="845" cy="170" r="4" fill="#059669"/><text x="858" y="175" fill="#047857">n5</text>
<path d="M845 210V230m0 40v15m-18 0h36m-30 7h24m-18 7h12" fill="none" stroke="#1f2937" stroke-width="2"/>
<rect x="837" y="230" width="16" height="40" fill="white" stroke="#1f2937" stroke-width="2"/>
<text x="870" y="250">R32</text><text x="870" y="273">2.2 kΩ</text>
<text x="80" y="330">Actual input: v(n31), V</text>
${renderTrace({ timeSeconds, volts: inputVolts, minimumVolts: -12, maximumVolts: 12, top: 345, color: "#2563eb" })}
<text x="80" y="495">Actual measured response: v(n5), V</text>
${renderTrace({ timeSeconds, volts: nodeVolts, minimumVolts: nodeMinimumVolts, maximumVolts: nodeMaximumVolts, top: 510, color: "#059669" })}
<text x="80" y="642">0</text><text x="500" y="642" text-anchor="middle">12.5</text><text x="920" y="642" text-anchor="end">25 ms</text>
<text x="500" y="670" text-anchor="middle">First 25 ms shown; the traces stop wherever the engine stopped</text>
<text x="80" y="707">Full simulation coverage: 0–2 s</text>
<rect x="80" y="720" width="840" height="18" fill="#e5e7eb"/>
<rect x="80" y="720" width="${(840 * Math.min(stopSeconds / 2, 1)).toFixed(3)}" height="18" fill="${complete ? "#059669" : "#dc2626"}"/>
<text x="500" y="772" text-anchor="middle" fill="${complete ? "#047857" : "#b91c1c"}">${complete ? "Completed 2 s without an abort" : `Aborted at ${(stopSeconds * 1000).toFixed(3)} ms / 2000 ms`} · ${timeSeconds.length} accepted samples</text>
</g></svg>\n`;
}
