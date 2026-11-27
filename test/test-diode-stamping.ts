import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import looksSame from "looks-same";
import { Simulation } from "../src/simulationLink.ts";
import { renderDiodeStampingSvg } from "./fixtures/renderDiodeStampingSvg.ts";
import { ensureFileFetch } from "./runSimulationRegressionTest.ts";

async function main(): Promise<void> {
  ensureFileFetch();
  const sim = new Simulation({ ngBehavior: "psa" });
  await sim.start();
  sim.setNetList(await readFile(new URL("./fixtures/diode-stamping.cir", import.meta.url), "utf8"));
  const result = await sim.runSim();
  assert.equal(result.dataType, "real");
  const timeSeconds = result.data.find((vector) => vector.type === "time")?.values;
  const nodeVolts = result.data.find((vector) => vector.name === "v(node)")?.values;
  const referenceVolts = result.data.find((vector) => vector.name === "v(reference)")?.values;
  const comparatorVolts = result.data.find((vector) => vector.name === "v(compare)")?.values;
  assert(timeSeconds && nodeVolts && referenceVolts && comparatorVolts);
  assert(result.data.every((vector) => vector.values.every(Number.isFinite)));
  assert(timeSeconds.at(-1)! < 2e-9, "Expected the diode stamping failure");
  assert(sim.getError().some((message) => /timestep too small/i.test(message)));
  const svg = renderDiodeStampingSvg({ timeSeconds, nodeVolts, referenceVolts, comparatorVolts });
  const snapshotUrl = new URL("./fixtures/diode-stamping.expected.svg", import.meta.url);
  if (process.env.UPDATE_SNAPSHOTS === "1") await writeFile(snapshotUrl, svg);
  const comparison = await looksSame(Buffer.from(svg), Buffer.from(await readFile(snapshotUrl, "utf8")));
  assert(comparison.equal, "Diode stamping snapshot changed; regenerate with UPDATE_SNAPSHOTS=1");
  console.log("Diode stamping reproduction snapshot passed");
}

if (process.argv.includes("--simulation-child")) {
  setTimeout(() => { console.error("Diode stamping test timed out"); process.exit(1); }, 30_000);
  main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
} else {
  execFileSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), "--simulation-child"], { stdio: "inherit", timeout: 30_000 });
}
