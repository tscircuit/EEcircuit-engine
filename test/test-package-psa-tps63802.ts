import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureFileFetch, type SimulationInstance } from "./runSimulationRegressionTest.ts";

function prepareFigureNetlist(): string {
  const circuitPath = resolve(
    "test/fixtures/figure-10-17/tps63802-pfm-buck.cir"
  );
  const netlist = readFileSync(circuitPath, "utf8");

  return netlist
    .replace(/\.control[\s\S]*?\.endc/im, "")
    .replace(/^\s*\.tran\s+.*$/im, ".tran 100n 2u UIC");
}

async function main(): Promise<void> {
  ensureFileFetch();

  const { Simulation } = (await import("../dist/eecircuit-engine.mjs")) as {
    Simulation: new (options?: { ngBehavior?: string }) => SimulationInstance;
  };

  const sim = new Simulation({ ngBehavior: "psa" });
  await sim.start();
  sim.setNetList(prepareFigureNetlist());

  const result = await sim.runSim();

  console.log(result.header);
  console.log(`numVariables: ${result.numVariables}`);
  console.log(`numPoints: ${result.numPoints}`);
  console.log(`variables: ${result.variableNames.join(", ")}`);

  const expectedVariables = [
    "v(vout_probe)",
    "v(n3)",
    "v(n2)",
    "i(ll1)",
    "v(xsimulation_spice_subcircuit_0.pwm)",
  ];

  for (const variableName of expectedVariables) {
    if (!result.variableNames.includes(variableName)) {
      throw new Error(`Expected ${variableName} in package PSA TPS63802 result`);
    }
  }

  if (result.numPoints < 2) {
    throw new Error(`Expected transient data points, got ${result.numPoints}`);
  }

  const vout = result.data.find((entry) => entry.name === "v(vout_probe)");
  if (!vout || vout.type !== "voltage") {
    throw new Error("Expected v(vout_probe) voltage data");
  }

  const finiteVout = vout.values.every((value) => Number.isFinite(value));
  if (!finiteVout) {
    throw new Error("Expected finite v(vout_probe) values");
  }

  console.log("Package PSA TPS63802 test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
