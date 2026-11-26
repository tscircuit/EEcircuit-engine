import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import looksSame from "looks-same";
import { Simulation } from "../src/simulationLink.ts";
import { renderLoadedPowerTreeSvg } from "./fixtures/renderLoadedPowerTreeSvg.ts";
import { ensureFileFetch } from "./runSimulationRegressionTest.ts";

async function main(): Promise<void> {
    ensureFileFetch();
    const sim = new Simulation({ ngBehavior: "psa" });
    await sim.start();
    sim.setNetList(await readFile(new URL("./fixtures/loaded-ti-power-tree.cir", import.meta.url), "utf8"));
    const result = await sim.runSim();
    assert.equal(result.dataType, "real");
    const timeSeconds = result.data.find((vector) => vector.type === "time")?.values;
    assert(timeSeconds && timeSeconds.length > 0);
    assert(result.data.every((vector) => vector.values.every(Number.isFinite)));
    const errorMessage = sim.getError().find((message) => /timestep too small/i.test(message)) ?? "";
    const svg = renderLoadedPowerTreeSvg({ lastTimeSeconds: timeSeconds.at(-1)!, errorMessage });
    const snapshotUrl = new URL("./fixtures/loaded-ti-power-tree.expected.svg", import.meta.url);
    if (process.env.UPDATE_SNAPSHOTS === "1") await writeFile(snapshotUrl, svg);
    const comparison = await looksSame(Buffer.from(svg), Buffer.from(await readFile(snapshotUrl, "utf8")));
    assert(comparison.equal, "Loaded TI power tree SVG mismatch; use UPDATE_SNAPSHOTS=1 to regenerate");
    console.log("Loaded TI power tree visual regression passed");
}

const timeout = setTimeout(() => {
    console.error("Loaded TI power tree test did not finish within 60 seconds");
    process.exit(1);
}, 60_000);

main().catch((error) => {
    console.error(error);
    process.exit(1);
}).finally(() => clearTimeout(timeout));
