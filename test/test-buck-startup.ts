import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import looksSame from "looks-same";
import { Simulation } from "../src/simulationLink.ts";
import { ensureFileFetch } from "./runSimulationRegressionTest.ts";
import { renderBuckStartupSvg } from "./fixtures/renderBuckStartupSvg.ts";

async function main(): Promise<void> {
    ensureFileFetch();
    const sim = new Simulation({ ngBehavior: "psa" });
    await sim.start();
    const netList = await readFile(new URL("./fixtures/tps54320-startup.cir", import.meta.url), "utf8");
    for (const method of [undefined, "gear"] as const) {
        sim.setNetList(method ? netList.replace(/^(\.tran)/im, `.options method=${method}\n$1`) : netList);
        const started = performance.now();
        const result = await sim.runSim();
        const elapsedMs = performance.now() - started;
        assert(result.dataType === "real");
        const seconds = result.data.find((vector) => vector.type === "time")?.values;
        const volts = result.data.find((vector) => vector.name === "v(vout)")?.values;
        assert(seconds && volts);
        assert(Math.abs(seconds[seconds.length - 1] - 50e-6) < 1e-18);
        assert(seconds.every(Number.isFinite) && volts.every(Number.isFinite));
        const svg = renderBuckStartupSvg({ seconds, volts, method });
        const snapshotUrl = new URL(`./fixtures/tps54320-startup${method ? `-${method}` : ""}.expected.svg`, import.meta.url);
        if (process.env.UPDATE_SNAPSHOTS === "1") await writeFile(snapshotUrl, svg);
        const expectedSvg = await readFile(snapshotUrl, "utf8");
        const comparison = await looksSame(Buffer.from(svg), Buffer.from(expectedSvg));
        assert(comparison.equal, "TPS54320 startup SVG mismatch; regenerate with UPDATE_SNAPSHOTS=1");
        console.log(JSON.stringify({ circuit: "TPS54320 startup", method: method ?? "trap", elapsedMs, points: result.numPoints, stopSeconds: seconds[seconds.length - 1] }));
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
