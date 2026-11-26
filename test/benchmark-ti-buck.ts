import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Simulation } from "../src/simulationLink.ts";
import { renderTiBuckRuntimeSvg } from "./fixtures/renderTiBuckRuntimeSvg.ts";
import { sampleTiBuckTrace } from "./fixtures/sampleTiBuckTrace.ts";
import { ensureFileFetch } from "./runSimulationRegressionTest.ts";

async function main(): Promise<void> {
    ensureFileFetch();
    const sim = new Simulation({ ngBehavior: "psa" });
    await sim.start();
    const fixture = await readFile(new URL("./fixtures/tps54320-startup.cir", import.meta.url), "utf8");
    const netList = fixture.replace(/^\.tran[^\n]*/im, ".tran 200n 8m UIC");
    const reference: { netlistSha256: string; trace: ReturnType<typeof sampleTiBuckTrace> } = JSON.parse(await readFile(new URL("./fixtures/ti-buck-startup.native.json", import.meta.url), "utf8"));
    assert.equal(createHash("sha256").update(netList).digest("hex"), reference.netlistSha256);
    // Insert a diagnostic command immediately before writing the result; do not run the circuit twice.
    const module = sim.__getSpiceModuleForTests() as { getInput(): string };
    const getInput = module.getInput;
    let pendingWrite: string | null = null;
    module.getInput = () => {
        if (pendingWrite !== null) {
            const command = pendingWrite;
            pendingWrite = null;
            return command;
        }
        const command = getInput();
        if (command.startsWith("write ")) {
            pendingWrite = command;
            return "rusage everything";
        }
        return command;
    };
    sim.setNetList(netList);
    const startedMs = performance.now();
    const result = await sim.runSim();
    const elapsedSeconds = (performance.now() - startedMs) / 1000;
    assert(result.dataType === "real");
    const timeSeconds = result.data.find((vector) => vector.type === "time")?.values;
    const outputVolts = result.data.find((vector) => vector.name === "v(vout)")?.values;
    assert(timeSeconds && outputVolts);
    assert(Math.abs(timeSeconds.at(-1)! - 8e-3) < 1e-12, "Buck startup did not reach 8 ms");
    assert(result.data.every((vector) => vector.values.every(Number.isFinite)));
    assert(!sim.getError().some((message) => /too small|aborted|fatal/i.test(message)));
    const trace = sampleTiBuckTrace({ timeSeconds, outputVolts });
    const maximumMeanErrorVolts = Math.max(...trace.meanOutputVolts.map((volts, index) => Math.abs(volts - reference.trace.meanOutputVolts[index])));
    const runtime = process.versions.bun ? `Bun ${process.versions.bun}` : `Node ${process.versions.node}`;
    const environment = `${runtime} · ${process.platform} ${process.arch}`;
    const report = { elapsedSeconds, environment, numPoints: result.numPoints, maximumMeanErrorVolts, trace, solverStatistics: sim.getInfo() };
    if (process.env.UPDATE_SNAPSHOTS === "1") {
        const svg = renderTiBuckRuntimeSvg({ ...report, reference });
        await writeFile(new URL("./fixtures/ti-buck-runtime.svg", import.meta.url), svg);
    }
    console.log(JSON.stringify(report));
    assert(maximumMeanErrorVolts < 0.02, `100 µs window means differ from native ngspice by ${maximumMeanErrorVolts} V`);
    assert(Math.abs(trace.meanOutputVolts.at(-1)! - 3.3) < 0.1, "Buck output did not regulate near 3.3 V");
}

if (!process.argv.includes("--simulation-child")) {
    // A parent process can interrupt a synchronous WASM loop; an in-process timer cannot.
    try {
        execFileSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), "--simulation-child"], {
            stdio: "inherit", timeout: 3_600_000,
        });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ETIMEDOUT") throw error;
        const reference = JSON.parse(readFileSync(new URL("./fixtures/ti-buck-startup.native.json", import.meta.url), "utf8"));
        if (process.env.UPDATE_SNAPSHOTS === "1") {
            const svg = renderTiBuckRuntimeSvg({
                elapsedSeconds: 3600, numPoints: 0, reference,
                environment: `Node ${process.versions.node} · ${process.platform} ${process.arch}`,
            });
            writeFileSync(new URL("./fixtures/ti-buck-runtime.svg", import.meta.url), svg);
        }
        console.log("TI buck benchmark returned no result within 60 minutes");
    }
} else {
    // Keep a pending bridge promise alive; the parent enforces the deadline.
    const timeout = setTimeout(() => process.exit(1), 3_660_000);
    main().then(() => { clearTimeout(timeout); process.exit(0); }).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
