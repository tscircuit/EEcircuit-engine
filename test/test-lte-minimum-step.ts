import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import looksSame from "looks-same";
import { Simulation } from "../src/simulationLink.ts";
import { minimumStepOutputVolts, renderMinimumStepSvg } from "./fixtures/renderMinimumStepSvg.ts";
import { ensureFileFetch } from "./runSimulationRegressionTest.ts";

async function main(): Promise<void> {
  ensureFileFetch();
  const sim = new Simulation({ ngBehavior: "psa" });
  await sim.start();
  const netList = await readFile(new URL("./fixtures/lte-minimum-step.cir", import.meta.url), "utf8");
  const maximumErrors: number[] = [];
  for (const [relativeTolerance, maximumErrorVolts] of [["1e-5", 2e-3], ["1e-7", 100e-6]] as const) {
    sim.setNetList(netList.replace("reltol=1e-5", `reltol=${relativeTolerance}`));
    const result = await sim.runSim();
    assert.equal(result.dataType, "real");
    const timeSeconds = result.data.find((vector) => vector.type === "time")?.values;
    const controlVolts = result.data.find((vector) => vector.name === "v(control)")?.values;
    const outputVolts = result.data.find((vector) => vector.name === "v(output)")?.values;
    assert(timeSeconds && controlVolts && outputVolts);
    assert(result.data.every((vector) => vector.values.every(Number.isFinite)));
    assert(Math.abs(timeSeconds.at(-1)! - 12e-6) < 1e-18, "RC response did not finish");
    assert(!sim.getError().some((message) => /too small|aborted|fatal/i.test(message)));
    const maximumError = Math.max(...timeSeconds.map((seconds, index) =>
      Math.abs(outputVolts[index] - minimumStepOutputVolts(seconds))));
    assert(maximumError < maximumErrorVolts, "Capacitor voltage differs from the exact RC response");
    maximumErrors.push(maximumError);
    if (relativeTolerance === "1e-5") {
      const svg = renderMinimumStepSvg({ timeSeconds, controlVolts, outputVolts });
      const snapshotUrl = new URL("./fixtures/lte-minimum-step.expected.svg", import.meta.url);
      if (process.env.UPDATE_SNAPSHOTS === "1") await writeFile(snapshotUrl, svg);
      const comparison = await looksSame(Buffer.from(svg), Buffer.from(await readFile(snapshotUrl, "utf8")));
      assert(comparison.equal, "Minimum-step snapshot changed; regenerate with UPDATE_SNAPSHOTS=1");
    }
  }
  assert(maximumErrors[1] < maximumErrors[0] / 5, "Tighter tolerance must improve the RC waveform");

  // A request below the floating-point clock resolution must still fail.
  sim.setNetList(netList.replace("reltol=1e-5", "reltol=1e-9"));
  const unresolved = await sim.runSim();
  assert.equal(unresolved.dataType, "real");
  assert(unresolved.data.find((vector) => vector.type === "time")!.values.at(-1)! < 12e-6);
  assert(sim.getError().some((message) => /timestep too small/i.test(message)));
  console.log("Minimum-step, waveform accuracy, and clock-resolution regressions passed");
}

if (process.argv.includes("--simulation-child")) {
  setTimeout(() => { console.error("Minimum-step test timed out"); process.exit(1); }, 30_000);
  main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
} else {
  execFileSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), "--simulation-child"], { stdio: "inherit", timeout: 30_000 });
}
