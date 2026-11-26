import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import looksSame from "looks-same";
import { Simulation } from "../src/simulationLink.ts";
import { compareLoadedPowerTree, renderLoadedPowerTreeSvg, type LoadedPowerTreeReference } from "./fixtures/renderLoadedPowerTreeSvg.ts";
import { ensureFileFetch } from "./runSimulationRegressionTest.ts";

async function main(): Promise<void> {
    ensureFileFetch();
    const sim = new Simulation({ ngBehavior: "psa" });
    await sim.start();
    const netList = await readFile(new URL("./fixtures/loaded-ti-power-tree.cir", import.meta.url), "utf8");
    sim.setNetList(netList);
    const result = await sim.runSim();
    assert.equal(result.dataType, "real");
    const timeSeconds = result.data.find((vector) => vector.type === "time")?.values;
    assert(timeSeconds && timeSeconds.length > 0);
    assert(result.data.every((vector) => vector.values.every(Number.isFinite)));
    const out12Volts = result.data.find((vector) => vector.name === "v(out12)")?.values;
    const out18Volts = result.data.find((vector) => vector.name === "v(out18)")?.values;
    assert(out12Volts && out18Volts);
    const samples = { timeSeconds, out12Volts, out18Volts };
    const reference: LoadedPowerTreeReference = JSON.parse(await readFile(new URL("./fixtures/loaded-ti-power-tree.native.json", import.meta.url), "utf8"));
    assert.equal(createHash("sha256").update(netList).digest("hex"), reference.netlistSha256, "Native reference input changed");
    if (Math.abs(timeSeconds.at(-1)! - 10e-6) < 1e-18) {
        const comparison = compareLoadedPowerTree(samples, reference);
        assert.equal(comparison.comparedPoints, 200);
        assert(comparison.maximumErrorVolts <= reference.maximumErrorVolts,
            `Power tree differs from native ngspice by ${comparison.maximumErrorVolts} V`);
    }
    const errorMessage = sim.getError().find((message) => /timestep too small/i.test(message)) ?? "";
    const svg = renderLoadedPowerTreeSvg({ samples, reference, errorMessage });
    const snapshotUrl = new URL("./fixtures/loaded-ti-power-tree.expected.svg", import.meta.url);
    if (process.env.UPDATE_SNAPSHOTS === "1") await writeFile(snapshotUrl, svg);
    const comparison = await looksSame(Buffer.from(svg), Buffer.from(await readFile(snapshotUrl, "utf8")));
    assert(comparison.equal, "Loaded TI power tree SVG mismatch; use UPDATE_SNAPSHOTS=1 to regenerate");
    console.log("Loaded TI power tree visual regression passed");
}

if (process.argv.includes("--simulation-child")) {
    const timeout = setTimeout(() => {
        console.error("Loaded TI power tree bridge did not respond within 180 seconds");
        process.exit(1);
    }, 180_000);
    main().then(() => {
        clearTimeout(timeout);
        process.exit(0);
    }).catch((error) => {
        console.error(error);
        process.exit(1);
    });
} else {
    // An in-process timer cannot interrupt a synchronous WASM solver loop.
    execFileSync(process.execPath, [
        ...process.execArgv, fileURLToPath(import.meta.url), "--simulation-child",
    ], { stdio: "inherit", timeout: 180_000 });
}
