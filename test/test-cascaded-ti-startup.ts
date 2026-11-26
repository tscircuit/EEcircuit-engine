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
    const netList = await readFile(new URL("./fixtures/cascaded-ti-startup.cir", import.meta.url), "utf8");
    sim.setNetList(netList);
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

    // At 700 µs, another event moves a provisional crossing earlier. Retaining
    // its stale root caused an endless same-time retry after the short case passed.
    sim.setNetList(netList.replace(/^\.tran[^\n]*/im, ".tran 1u 1m UIC"));
    const longerResult = await sim.runSim();
    assert.equal(longerResult.dataType, "real");
    const longerSeconds = longerResult.data.find((vector) => vector.type === "time")?.values;
    assert(longerSeconds && Math.abs(longerSeconds.at(-1)! - 1e-3) < 1e-15);
    assert(longerResult.data.every((vector) => vector.values.every(Number.isFinite)));
    assert(!sim.getError().some((message) => /too small|aborted|fatal/i.test(message)));
    console.log("Cascaded TI startup reached 1 ms without retrying a stale root");

    // After 1 µs, neither possible output satisfies this algebraic equation.
    // The recovery must preserve a genuine failure rather than accept one side.
    sim.setNetList(`Inconsistent comparator feedback
Bbad out 0 V={V(out)>.5 ? (time<1u ? 1 : 0) : 1}
Rload out 0 1k
.save V(out)
.tran 10n 2u UIC
.end
`);
    const inconsistentFeedback = await sim.runSim();
    assert(inconsistentFeedback.dataType === "real");
    const inconsistentSeconds = inconsistentFeedback.data.find((vector) => vector.type === "time")?.values;
    assert(inconsistentSeconds && inconsistentSeconds.at(-1)! < 2e-6);
    assert(sim.getError().some((message) => /timestep too small/i.test(message)));
    console.log("Inconsistent comparator feedback remains a simulation failure");
}

const timeout = setTimeout(() => {
    console.error("Cascaded startup test did not finish within 300 seconds");
    process.exit(1);
}, 300_000);

main().catch((error) => {
    console.error(error);
    process.exit(1);
}).finally(() => clearTimeout(timeout));
