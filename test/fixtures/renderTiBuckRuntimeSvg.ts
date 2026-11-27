import type { sampleTiBuckTrace } from "./sampleTiBuckTrace.ts";

type BuckTrace = ReturnType<typeof sampleTiBuckTrace>;

export function renderTiBuckRuntimeSvg({ elapsedSeconds, numPoints, environment, trace, maximumMeanErrorVolts, reference }: {
    elapsedSeconds: number;
    numPoints: number;
    environment: string;
    trace?: BuckTrace;
    maximumMeanErrorVolts?: number;
    reference: { trace: BuckTrace; elapsedSeconds?: number };
}): string {
    const runtime = (seconds: number): string => `${Math.floor(Math.round(seconds) / 60)} min ${Math.round(seconds) % 60} s`;
    const points = ({ seconds, volts, top, minimumSeconds, maximumSeconds, minimumVolts, maximumVolts }: {
        seconds: number[]; volts: number[]; top: number;
        minimumSeconds: number; maximumSeconds: number; minimumVolts: number; maximumVolts: number;
    }): string => seconds.map((time, index) => `${(100 + (time - minimumSeconds) / (maximumSeconds - minimumSeconds) * 800).toFixed(2)},${(top + 190 - (volts[index] - minimumVolts) / (maximumVolts - minimumVolts) * 190).toFixed(2)}`).join(" ");
    const startup = { top: 300, minimumSeconds: 0, maximumSeconds: 0.008, minimumVolts: 0, maximumVolts: 3.6 };
    const minimumRippleVolts = Math.floor(Math.min(trace?.rippleMinimumVolts ?? Infinity, reference.trace.rippleMinimumVolts) * 100) / 100;
    const maximumRippleVolts = Math.ceil(Math.max(trace?.rippleMaximumVolts ?? -Infinity, reference.trace.rippleMaximumVolts) * 100) / 100;
    const ripple = { top: 590, minimumSeconds: 0.00795, maximumSeconds: 0.008, minimumVolts: minimumRippleVolts, maximumVolts: maximumRippleVolts };
    const waveform = (samples: BuckTrace, color: string): string => `<polyline points="${points({ ...startup, seconds: samples.startupTimeSeconds, volts: samples.startupOutputVolts })}" fill="none" stroke="${color}" stroke-width="2"/>
<polyline points="${points({ ...ripple, seconds: samples.rippleTimeSeconds, volts: samples.rippleOutputVolts })}" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
<rect width="1000" height="1000" fill="white"/>
<g font-family="sans-serif" font-size="16" fill="#1f2937">
<text x="500" y="34" text-anchor="middle" font-size="24">TI TPS54320: 8 ms startup and settled ripple</text>
<text x="500" y="66" text-anchor="middle">12 V input → 3.3 V target · 1.1 Ω load (about 3 A)</text>
<g fill="#f3f4f6" stroke="#9ca3af">
<rect x="45" y="95" width="155" height="85" rx="8"/><rect x="260" y="95" width="200" height="85" rx="8"/>
<rect x="520" y="95" width="200" height="85" rx="8"/><rect x="780" y="95" width="175" height="85" rx="8"/>
</g><g text-anchor="middle">
<text x="122" y="129">DC input</text><text x="122" y="157">12 V</text>
<text x="360" y="129">TPS54320</text><text x="360" y="157">TI switching model</text>
<text x="620" y="129">Output filter</text><text x="620" y="157">6.8 µH / 47 µF</text>
<text x="867" y="129">Load</text><text x="867" y="157">1.1 Ω</text></g>
<g fill="none" stroke="#374151" stroke-width="2"><path d="M200 138 H260 m-7 -5 l7 5 -7 5"/><path d="M460 138 H520 m-7 -5 l7 5 -7 5"/><path d="M720 138 H780 m-7 -5 l7 5 -7 5"/></g>
<text x="500" y="220" text-anchor="middle" font-size="24" fill="${trace ? "#1f2937" : "#b91c1c"}">${trace ? `${runtime(elapsedSeconds)} to simulate 8 ms · ${numPoints.toLocaleString("en-US")} accepted samples` : `No result returned within ${(elapsedSeconds / 60).toFixed(0)} minutes`}</text>
<text x="500" y="250" text-anchor="middle">Requested 8 ms covers startup and settled 3.3 V regulation.</text>
<text x="100" y="285" font-weight="bold">Startup output voltage</text>
<g fill="none" stroke="#d1d5db"><path d="M100 300 H900 V490 H100 Z"/><path d="M100 590 H900 V780 H100 Z"/></g>
${waveform(reference.trace, "#9ca3af")}
${trace ? waveform(trace, "#2563eb") : ""}
<g font-size="14"><text x="88" y="305" text-anchor="end">3.6 V</text><text x="88" y="490" text-anchor="end">0 V</text>
<text x="100" y="515" text-anchor="middle">0 ms</text><text x="500" y="515" text-anchor="middle">4 ms</text><text x="900" y="515" text-anchor="middle">8 ms</text>
<text x="88" y="595" text-anchor="end">${minimumRippleVolts === maximumRippleVolts ? "" : maximumRippleVolts.toFixed(2)} V</text><text x="88" y="780" text-anchor="end">${minimumRippleVolts.toFixed(2)} V</text>
<text x="100" y="805" text-anchor="middle">7.95 ms</text><text x="900" y="805" text-anchor="middle">8.00 ms</text></g>
<text x="100" y="570" font-weight="bold">Settled output ripple (last 50 µs)</text>
<path d="M210 845 H250" stroke="#9ca3af" stroke-width="3"/><text x="260" y="850">Native ngspice 47</text>
<path d="M570 845 H610" stroke="#2563eb" stroke-width="3"/><text x="620" y="850">${trace ? "EEcircuit WASM" : "EEcircuit WASM: no result"}</text>
<text x="500" y="889" text-anchor="middle">${maximumMeanErrorVolts === undefined ? "Native reference is shown; the WASM run returned no output within the time limit." : `Largest difference in 100 µs output means: ${(maximumMeanErrorVolts * 1000).toFixed(2)} mV`}</text>
<text x="500" y="924" text-anchor="middle">${environment}${reference.elapsedSeconds === undefined ? "" : ` · Native reference: ${runtime(reference.elapsedSeconds)}`}</text>
<text x="500" y="957" text-anchor="middle">One run requested to 8 ms; elapsed time depends on machine load. Manual benchmark.</text>
</g></svg>\n`;
}
