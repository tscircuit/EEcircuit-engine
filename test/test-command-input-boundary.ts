import assert from "node:assert/strict";
import { Simulation } from "../src/simulationLink.ts";
import { ensureFileFetch } from "./runSimulationRegressionTest.ts";

async function main(): Promise<void> {
    ensureFileFetch();
    const sim = new Simulation();
    await sim.start();
    const module = sim.__getSpiceModuleForTests() as {
        handleThings(): void;
        getInput(): string;
    };
    let pauses = 0;
    let inputs = 0;
    const handleThings = module.handleThings;
    const getInput = module.getInput;
    module.handleThings = () => { pauses++; handleThings(); };
    module.getInput = () => { inputs++; return getInput(); };
    sim.setNetList(`Command input boundary
V1 output 0 1
R1 output 0 1k
.control
echo begin-control
let demo = 1
echo end-control
.endc
.save V(output)
.tran 1u 10u
.end
`);
    const result = await sim.runSim();
    assert(result.dataType === "real");
    assert.equal(result.data.find((vector) => vector.name === "v(output)")?.values.at(-1), 1);
    assert(sim.getInfo().includes("end-control"));
    assert.equal(pauses - inputs, 3, "Nested control commands also pause for external input");
    console.log(JSON.stringify({ pauses, inputs, extraPauses: pauses - inputs }));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
