import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderFigure1017ScopeSvg } from "./fixtures/figure-10-17/renderScopeSvg.ts";

type LooksSame = {
  (
    image1: string | Buffer,
    image2: string | Buffer,
    options?: { strict?: boolean; tolerance?: number }
  ): Promise<{ equal: boolean }>;
  createDiff(options: {
    reference: string | Buffer;
    current: string | Buffer;
    diff: string;
    highlightColor: string;
  }): Promise<null>;
};

const require = createRequire(import.meta.url);
const looksSame = require("looks-same") as LooksSame;

function patchWrdata(netlist: string, datPath: string): string {
  const wrdataLine = /^(\s*wrdata\s+)(\S+)(.*)$/im;
  if (!wrdataLine.test(netlist)) {
    throw new Error("No wrdata line found in figure 10-17 circuit fixture");
  }

  return netlist.replace(wrdataLine, (_match, prefix: string, _oldPath: string, rest: string) => {
    return `${prefix}${datPath}${rest}`;
  });
}

function runNgspice(circuitPath: string, workDir: string, logPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ngspice", ["-b", "-o", logPath, circuitPath], {
      cwd: workDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", async (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const log = await readFile(logPath, "utf8").catch(() => "");
      reject(new Error(
        [
          `ngspice failed with exit code ${code}`,
          stdout.trim(),
          stderr.trim(),
          log ? `ngspice log:\n${log}` : "",
        ].filter(Boolean).join("\n\n")
      ));
    });
  });
}

async function main(): Promise<void> {
  const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "figure-10-17");
  const circuitFileName = "tps63802-pfm-buck.cir";
  const circuitPath = join(fixtureDir, circuitFileName);
  const expectedSvgPath = join(
    fixtureDir,
    "tps63802-pfm-buck.expected.svg"
  );

  const workDir = await mkdtemp(join(os.tmpdir(), "eecircuit-figure-10-17-"));

  try {
    const datFileName = "tps63802-pfm-buck.dat";
    const datPath = join(workDir, datFileName);
    const patchedCircuitPath = join(workDir, circuitFileName);
    const logPath = join(workDir, "ngspice.log");

    const [netlist, expectedSvg] = await Promise.all([
      readFile(circuitPath, "utf8"),
      readFile(expectedSvgPath, "utf8"),
    ]);

    await writeFile(join(workDir, ".spiceinit"), "set ngbehavior=psa\n", "utf8");
    await writeFile(patchedCircuitPath, patchWrdata(netlist, datPath), "utf8");
    await runNgspice(patchedCircuitPath, workDir, logPath);

    const datText = await readFile(datPath, "utf8");
    const actualSvg = renderFigure1017ScopeSvg(datText, datFileName);

    const result = await looksSame(Buffer.from(actualSvg), Buffer.from(expectedSvg), {
      strict: false,
      tolerance: 2,
    });

    if (!result.equal) {
      const diffPath = expectedSvgPath.replace(".expected.svg", ".diff.png");
      await looksSame.createDiff({
        reference: Buffer.from(expectedSvg),
        current: Buffer.from(actualSvg),
        diff: diffPath,
        highlightColor: "#ff00ff",
      });
      throw new Error(`TPS63802 scope SVG regression mismatch. Diff saved at ${diffPath}`);
    }

    console.log("TPS63802 scope SVG regression passed");
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
