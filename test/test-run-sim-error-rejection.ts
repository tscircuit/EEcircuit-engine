import { Simulation } from "../src/simulationLink.ts";
import { ensureFileFetch } from "./runSimulationRegressionTest.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectRejectsWithin(
  promise: Promise<unknown>,
  timeoutMs: number
): Promise<unknown> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise.then(
        () => {
          throw new Error("Expected runSim() to reject, but it resolved");
        },
        (error) => error
      ),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`runSim() did not settle within ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function main(): Promise<void> {
  ensureFileFetch();

  await expectRunSimFailure(
    `* invalid subckt
V1 in 0 DC 1
X1 in 0 missing_subckt
.tran 1n 10n
.end
`,
    /unknown subckt|Simulation interrupted due to error|there aren't any circuits loaded/i
  );

  await expectRunSimFailure(
    `* conflicting ideal voltage sources
V1 n 0 DC 24
V2 n 0 DC 0
.tran 1n 10n
.end
`,
    /singular|timestep|aborted|no writable vector/i
  );

  console.log("runSim error rejection regression test passed");
}

async function expectRunSimFailure(
  netList: string,
  detailPattern: RegExp
): Promise<void> {
  const sim = new Simulation();
  await sim.start();
  sim.setNetList(netList);

  const error = await expectRejectsWithin(sim.runSim(), 5_000);

  assert(error instanceof Error, "Expected runSim() to reject with an Error");
  assert(
    /ngspice simulation failed/i.test(error.message),
    `Expected ngspice failure message, got: ${error.message}`
  );
  assert(
    detailPattern.test(error.message),
    `Expected ngspice error details, got: ${error.message}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
