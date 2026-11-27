import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import looksSame from "looks-same";
import { Simulation } from "../src/simulationLink.ts";
import { renderAcceptedTransientRetrySvg } from "./fixtures/renderAcceptedTransientRetrySvg.ts";
import { ensureFileFetch } from "./runSimulationRegressionTest.ts";

async function main(): Promise<void> {
    ensureFileFetch();
    const sim = new Simulation({ ngBehavior: "psa" });
    await sim.start();
    sim.setNetList(await readFile(new URL("./fixtures/accepted-transient-retry.cir", import.meta.url), "utf8"));
    const result = await sim.runSim();
    assert.equal(result.dataType, "real");
    const timeSeconds = result.data.find((vector) => vector.type === "time")?.values;
    const inputVolts = result.data.find((vector) => vector.name === "v(n31)")?.values;
    const nodeVolts = result.data.find((vector) => vector.name === "v(n5)")?.values;
    assert(timeSeconds && inputVolts && nodeVolts);
    assert(result.data.every((vector) => vector.values.every(Number.isFinite)));
    assert(inputVolts.every((volts, index) => Math.abs(volts - 12 * Math.sin(2 * Math.PI * 200 * timeSeconds[index])) < 1e-10));
    assert(timeSeconds.at(-1)! < 2, "Repro unexpectedly completed; update the failure assertion with the fix");
    assert(sim.getError().some((message) => /timestep too small/i.test(message)));
    const svg = renderAcceptedTransientRetrySvg({ timeSeconds, inputVolts, nodeVolts });
    const snapshotUrl = new URL("./fixtures/accepted-transient-retry.expected.svg", import.meta.url);
    if (process.env.UPDATE_SNAPSHOTS === "1") await writeFile(snapshotUrl, svg);
    const comparison = await looksSame(Buffer.from(svg), Buffer.from(await readFile(snapshotUrl, "utf8")));
    assert(comparison.equal, "Accepted-solution retry snapshot changed; regenerate with UPDATE_SNAPSHOTS=1");
    console.log("Accepted-solution retry repro passed");
}

if (process.argv.includes("--simulation-child")) {
    setTimeout(() => { console.error("Accepted-solution retry test timed out"); process.exit(1); }, 30_000);
    main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
} else {
    execFileSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), "--simulation-child"], { stdio: "inherit", timeout: 30_000 });
}
