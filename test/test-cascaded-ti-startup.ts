import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import looksSame from "looks-same";
import { Simulation } from "../src/simulationLink.ts";
import { renderCascadedStartupSvg } from "./fixtures/renderCascadedStartupSvg.ts";
import { ensureFileFetch } from "./runSimulationRegressionTest.ts";

async function main(): Promise<void> {
    ensureFileFetch();
    const sim = new Simulation({ ngBehavior: "psa" });
    await sim.start();
    sim.setNetList(await readFile(new URL("./fixtures/cascaded-ti-startup.cir", import.meta.url), "utf8"));
    const result = await sim.runSim();
    assert.equal(result.dataType, "real");
    const timeSeconds = result.data.find((vector) => vector.type === "time")?.values;
    assert(timeSeconds && timeSeconds.length > 0);
    assert(timeSeconds.every(Number.isFinite));
    const errorMessage = sim.getError().find((message) => /timestep too small/i.test(message)) ?? "";
    const svg = renderCascadedStartupSvg({ lastTimeSeconds: timeSeconds.at(-1)!, errorMessage });
    const snapshotUrl = new URL("./fixtures/cascaded-ti-startup.expected.svg", import.meta.url);
    if (process.env.UPDATE_SNAPSHOTS === "1") await writeFile(snapshotUrl, svg);
    const expectedSvg = await readFile(snapshotUrl, "utf8");
    const comparison = await looksSame(Buffer.from(svg), Buffer.from(expectedSvg));
    assert(comparison.equal, "Cascaded startup SVG mismatch; use UPDATE_SNAPSHOTS=1 to regenerate");
    console.log("Cascaded TI startup visual regression passed");
}

const timeout = setTimeout(() => {
    console.error("Cascaded startup test did not finish within 30 seconds");
    process.exit(1);
}, 30_000);

main().catch((error) => {
    console.error(error);
    process.exit(1);
}).finally(() => clearTimeout(timeout));
