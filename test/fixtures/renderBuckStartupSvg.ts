export function renderBuckStartupSvg(samples: { seconds: number[]; volts: number[]; method?: "gear" }): string {
    const stride = Math.ceil(samples.seconds.length / 600);
    const points = samples.seconds.flatMap((seconds, index) => {
        if (index % stride && index !== samples.seconds.length - 1) return [];
        return [`${(80 + seconds * 16e6).toFixed(3)},${(350 - samples.volts[index] * 6000).toFixed(3)}`];
    }).join(" ");
    const ticks = [0, 10, 20, 30, 40].map((mv) => {
        const y = 350 - mv * 6;
        return `<line x1="80" y1="${y}" x2="880" y2="${y}" stroke="#e5e7eb"/><text x="65" y="${y + 5}" text-anchor="end">${mv}</text>`;
    }).join("");
    const times = [0, 10, 20, 30, 40, 50].map((us) => `<text x="${80 + us * 16}" y="378" text-anchor="middle">${us}</text>`).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="450" viewBox="0 0 960 450">
<rect width="960" height="450" fill="white"/>
<g font-family="sans-serif" font-size="15" fill="#1f2937">
<text x="480" y="30" text-anchor="middle" font-size="21">TPS54320 startup: first 50 µs${samples.method ? ` (${samples.method})` : ""}</text>
<text x="480" y="60" text-anchor="middle">12 V DC → TI switching model → 6.8 µH / 47 µF → 1.1 Ω</text>
<text x="480" y="85" text-anchor="middle">Benchmark window; the 3.3 V rail has not settled yet.</text>
${ticks}${times}
<polyline points="${points}" fill="none" stroke="#2563eb" stroke-width="2"/>
<text x="480" y="410" text-anchor="middle">Time (µs)</text>
<text transform="translate(25 230) rotate(-90)" text-anchor="middle">Output (mV)</text>
<text x="480" y="438" text-anchor="middle">Waveform regression; elapsed solver time is printed by the test.</text>
</g></svg>\n`;
}
