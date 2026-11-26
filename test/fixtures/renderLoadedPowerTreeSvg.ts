export type LoadedPowerTreeSamples = {
    timeSeconds: number[];
    out12Volts: number[];
    out18Volts: number[];
};

export type LoadedPowerTreeReference = LoadedPowerTreeSamples & {
    simulator: string;
    netlistSha256: string;
    maximumErrorVolts: number;
};

export function compareLoadedPowerTree(samples: LoadedPowerTreeSamples, reference: LoadedPowerTreeReference) {
    let comparedPoints = 0;
    let maximumErrorVolts = 0;
    let right = 1;
    for (let point = 1; point < reference.timeSeconds.length; point++) {
        const seconds = reference.timeSeconds[point];
        if (seconds > samples.timeSeconds.at(-1)!) break;
        while (right < samples.timeSeconds.length - 1 && samples.timeSeconds[right] < seconds) right++;
        const fraction = (seconds - samples.timeSeconds[right - 1]) /
            (samples.timeSeconds[right] - samples.timeSeconds[right - 1]);
        for (const rail of ["out12Volts", "out18Volts"] as const) {
            const actualVolts = samples[rail][right - 1] + fraction * (samples[rail][right] - samples[rail][right - 1]);
            maximumErrorVolts = Math.max(maximumErrorVolts, Math.abs(actualVolts - reference[rail][point]));
        }
        comparedPoints++;
    }
    return { comparedPoints, maximumErrorVolts };
}

function renderRailPoints(samples: LoadedPowerTreeSamples, rail: "out12Volts" | "out18Volts"): string {
    const stride = Math.max(1, Math.ceil(samples.timeSeconds.length / 600));
    return samples.timeSeconds.flatMap((seconds, index) => index % stride && index !== samples.timeSeconds.length - 1 ? [] :
        [`${(90 + seconds / 10e-6 * 820).toFixed(3)},${(585 - samples[rail][index] / .25 * 220).toFixed(3)}`]).join(" ");
}

export function renderLoadedPowerTreeSvg({ samples, reference, errorMessage }: {
    samples: LoadedPowerTreeSamples;
    reference: LoadedPowerTreeReference;
    errorMessage: string;
}): string {
    const lastTimeSeconds = samples.timeSeconds.at(-1)!;
    const comparison = compareLoadedPowerTree(samples, reference);
    const complete = lastTimeSeconds >= 10e-6 - 1e-20 && !errorMessage;
    const color = complete ? "#166534" : "#b91c1c";
    const progressX = 90 + Math.min(lastTimeSeconds / 10e-6, 1) * 820;
    const status = `${complete ? "Completed" : "Stopped at"} ${lastTimeSeconds < 1e-6 ? `${(lastTimeSeconds * 1e9).toFixed(3)} ns` : `${(lastTimeSeconds * 1e6).toFixed(3)} µs`} of 10.000 µs`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
<rect width="1000" height="1000" fill="white"/>
<g font-family="sans-serif" font-size="15" fill="#1f2937">
<text x="500" y="36" text-anchor="middle" font-size="24">Loaded TI power tree: comparator event regression</text>
<text x="500" y="68" text-anchor="middle">Actual input circuit and requested loads · TI model equations retained</text>
<g fill="#f3f4f6" stroke="#9ca3af">
<rect x="30" y="173" width="120" height="95" rx="8"/>
<rect x="200" y="160" width="200" height="120" rx="8"/>
<rect x="450" y="160" width="200" height="120" rx="8"/>
<rect x="730" y="95" width="235" height="105" rx="8"/>
<rect x="730" y="240" width="235" height="105" rx="8"/>
</g>
<g text-anchor="middle">
<text x="90" y="210" font-weight="bold">DC input</text><text x="90" y="241">24 V</text>
<text x="300" y="192" font-weight="bold">LMZM33602</text>
<text x="300" y="220">12 V target · 22 µF</text><text x="300" y="248">Timing resistor: 44.2 kΩ</text>
<text x="550" y="192" font-weight="bold">TPS82130</text>
<text x="550" y="220">5 V bus · 22 µF</text><text x="550" y="248">Soft start: 10 nF</text>
<text x="847" y="125" font-weight="bold">TPS82084 → 1.2 V</text>
<text x="847" y="154">22 µF · 0.5 ↔ 1 A load</text><text x="847" y="181">1 ns load edges</text>
<text x="847" y="270" font-weight="bold">TPS82085 → 1.8 V</text>
<text x="847" y="299">22 µF · 0.75 ↔ 1.5 A load</text><text x="847" y="326">1 ns load edges</text>
</g>
<g fill="none" stroke="#374151" stroke-width="2">
<path d="M 150 220 H 200 m -7 -5 l 7 5 -7 5"/>
<path d="M 400 220 H 450 m -7 -5 l 7 5 -7 5"/>
<path d="M 650 220 H 690 V 147 H 730 m -7 -5 l 7 5 -7 5"/>
<path d="M 690 220 V 292 H 730 m -7 -5 l 7 5 -7 5"/>
</g>
<text x="500" y="390" text-anchor="middle" font-size="25" fill="${color}">${status}</text>
<path d="M 90 425 H 910" stroke="#d1d5db" stroke-width="12"/>
<path d="M 90 425 H ${progressX.toFixed(3)}" stroke="${color}" stroke-width="12"/>
<circle cx="${progressX.toFixed(3)}" cy="425" r="7" fill="${color}"/>
<text x="90" y="459" text-anchor="middle">0</text><text x="910" y="459" text-anchor="middle">10 µs requested</text>
<text x="500" y="500" text-anchor="middle" font-size="20">Output voltages: native reference and engine result</text>
<g stroke="#e5e7eb"><path d="M90 585 H910 M90 673 H910 M90 761 H910 M90 849 H910"/></g>
<g text-anchor="end"><text x="75" y="590">0</text><text x="75" y="678">−0.1</text><text x="75" y="766">−0.2</text><text x="75" y="854">−0.3</text></g>
<polyline points="${renderRailPoints(reference, "out12Volts")}" fill="none" stroke="#6b7280" stroke-width="3" stroke-dasharray="7 5"/>
<polyline points="${renderRailPoints(reference, "out18Volts")}" fill="none" stroke="#6b7280" stroke-width="3" stroke-dasharray="7 5"/>
<polyline points="${renderRailPoints(samples, "out12Volts")}" fill="none" stroke="#2563eb" stroke-width="2"/>
<polyline points="${renderRailPoints(samples, "out18Volts")}" fill="none" stroke="#9333ea" stroke-width="2"/>
<g text-anchor="middle"><text x="90" y="878">0</text><text x="500" y="878">5</text><text x="910" y="878">10 µs</text></g>
<text transform="translate(28 720) rotate(-90)" text-anchor="middle">Output voltage (V)</text>
<text x="110" y="540" fill="#6b7280">Dashed: ngspice 47</text><text x="410" y="540" fill="#2563eb">Engine OUT12</text><text x="660" y="540" fill="#9333ea">Engine OUT18</text>
<text x="500" y="912" text-anchor="middle" fill="${color}">${complete ? `Compared ${comparison.comparedPoints}/200 reference checkpoints; maximum error ${(comparison.maximumErrorVolts * 1000).toFixed(4)} mV` : "Solver aborted before completing the reference window."}</text>
<text x="500" y="948" text-anchor="middle">Initial current loads discharge the capacitors before the upstream rails start.</text>
<text x="500" y="978" text-anchor="middle">This tests initialization and convergence; the rail targets above are not settled values.</text>
</g></svg>\n`;
}
