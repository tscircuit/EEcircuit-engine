import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { Simulation } from "../src/simulationLink.ts";
import { renderTiBuckRuntimeSvg } from "./fixtures/renderTiBuckRuntimeSvg.ts";
import { ensureFileFetch } from "./runSimulationRegressionTest.ts";

async function main(): Promise<void> {
    ensureFileFetch();
    const sim = new Simulation({ ngBehavior: "psa" });
    await sim.start();
    const fixture = await readFile(new URL("./fixtures/tps54320-startup.cir", import.meta.url), "utf8");
    const netList = fixture.replace(/^\.tran[^\n]*/im, ".tran 100n 100u UIC");
    const runSeconds: number[] = [];
    let lastTimeSeconds = 0;
    let numPoints = 0;
    for (let repeat = 0; repeat < 3; repeat++) {
        sim.setNetList(netList);
        const startedMs = performance.now();
        const result = await sim.runSim();
        runSeconds.push((performance.now() - startedMs) / 1000);
        assert(result.dataType === "real");
        const seconds = result.data.find((vector) => vector.type === "time")?.values;
        assert(seconds && Math.abs(seconds.at(-1)! - 100e-6) < 1e-15);
        assert(result.data.every((vector) => vector.values.every(Number.isFinite)));
        assert(!sim.getError().some((message) => /too small|aborted|fatal/i.test(message)));
        lastTimeSeconds = seconds.at(-1)!;
        numPoints = result.numPoints;
    }
    const medianSeconds = [...runSeconds].sort((left, right) => left - right)[1];
    let runtime = `Node ${process.versions.node}`;
    if (process.versions.bun) runtime = `Bun ${process.versions.bun}`;
    const environment = `${runtime} · ${process.platform} ${process.arch}`;
    if (process.env.UPDATE_SNAPSHOTS === "1") {
        const svg = renderTiBuckRuntimeSvg({ medianSeconds, lastTimeSeconds, numPoints, environment });
        await writeFile(new URL("./fixtures/ti-buck-runtime.svg", import.meta.url), svg);
    }
    console.log(JSON.stringify({ environment, runSeconds, medianSeconds, lastTimeSeconds, numPoints }));
}

const timeout = setTimeout(() => {
    console.error("TI buck benchmark did not finish within 300 seconds");
    process.exit(1);
}, 300_000);

main().catch((error) => {
    console.error(error);
    process.exit(1);
}).finally(() => clearTimeout(timeout));
