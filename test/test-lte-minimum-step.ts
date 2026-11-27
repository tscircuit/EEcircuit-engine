import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import looksSame from "looks-same";
import { Simulation } from "../src/simulationLink.ts";
import { renderMinimumStepSvg } from "./fixtures/renderMinimumStepSvg.ts";
import { ensureFileFetch } from "./runSimulationRegressionTest.ts";

async function main(): Promise<void> {
  ensureFileFetch();
  const sim = new Simulation({ ngBehavior: "psa" });
  await sim.start();
  sim.setNetList(await readFile(new URL("./fixtures/lte-minimum-step.cir", import.meta.url), "utf8"));
  const result = await sim.runSim();
  assert.equal(result.dataType, "real");
  const timeSeconds = result.data.find((vector) => vector.type === "time")?.values;
  const controlVolts = result.data.find((vector) => vector.name === "v(control)")?.values;
  const outputVolts = result.data.find((vector) => vector.name === "v(output)")?.values;
  assert(timeSeconds && controlVolts && outputVolts);
  assert(result.data.every((vector) => vector.values.every(Number.isFinite)));
  assert(timeSeconds.at(-1)! < 12e-6, "Expected the minimum-step abort");
  assert(sim.getError().some((message) => /timestep too small/i.test(message)));
  const svg = renderMinimumStepSvg({ timeSeconds, controlVolts, outputVolts });
  const snapshotUrl = new URL("./fixtures/lte-minimum-step.expected.svg", import.meta.url);
  if (process.env.UPDATE_SNAPSHOTS === "1") await writeFile(snapshotUrl, svg);
  const comparison = await looksSame(Buffer.from(svg), Buffer.from(await readFile(snapshotUrl, "utf8")));
  assert(comparison.equal, "Minimum-step snapshot changed; regenerate with UPDATE_SNAPSHOTS=1");
  console.log("Minimum-step reproduction snapshot passed");
}

if (process.argv.includes("--simulation-child")) {
  setTimeout(() => { console.error("Minimum-step test timed out"); process.exit(1); }, 30_000);
  main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
} else {
  execFileSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), "--simulation-child"], { stdio: "inherit", timeout: 30_000 });
}
