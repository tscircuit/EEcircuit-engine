export function sampleTiBuckTrace({ timeSeconds, outputVolts }: {
    timeSeconds: number[];
    outputVolts: number[];
}) {
    let sampleIndex = 0;
    const interpolate = (seconds: number): number => {
        while (sampleIndex + 1 < timeSeconds.length && timeSeconds[sampleIndex + 1] < seconds) sampleIndex++;
        const nextIndex = Math.min(sampleIndex + 1, timeSeconds.length - 1);
        const spanSeconds = timeSeconds[nextIndex] - timeSeconds[sampleIndex];
        const fraction = spanSeconds > 0 ? Math.max(0, Math.min(1, (seconds - timeSeconds[sampleIndex]) / spanSeconds)) : 0;
        return outputVolts[sampleIndex] + fraction * (outputVolts[nextIndex] - outputVolts[sampleIndex]);
    };
    const startupTimeSeconds = Array.from({ length: 401 }, (_, index) => index * 20e-6);
    const startupOutputVolts = startupTimeSeconds.map(interpolate);
    sampleIndex = 0;
    // Average uniformly in time, so adaptive timestep density cannot bias the result.
    const meanOutputVolts = Array.from({ length: 80 }, (_, interval) => {
        let sumVolts = 0;
        for (let index = 0; index < 100; index++) sumVolts += interpolate((interval * 100 + index + 0.5) * 1e-6);
        return sumVolts / 100;
    });
    sampleIndex = 0;
    const rippleTimeSeconds = Array.from({ length: 1001 }, (_, index) => 7.95e-3 + index * 50e-9);
    const rippleOutputVolts = rippleTimeSeconds.map(interpolate);
    let rippleMinimumVolts = Infinity;
    let rippleMaximumVolts = -Infinity;
    for (let index = 0; index < timeSeconds.length; index++) {
        if (timeSeconds[index] < 7.95e-3) continue;
        rippleMinimumVolts = Math.min(rippleMinimumVolts, outputVolts[index]);
        rippleMaximumVolts = Math.max(rippleMaximumVolts, outputVolts[index]);
    }
    return {
        startupTimeSeconds, startupOutputVolts, meanOutputVolts, rippleTimeSeconds, rippleOutputVolts,
        rippleMinimumVolts, rippleMaximumVolts,
    };
}
