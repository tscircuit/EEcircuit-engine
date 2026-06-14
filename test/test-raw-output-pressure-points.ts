import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function testRawOutputIsParsedOnce(): void {
    const simulationLinkPath = join(
        dirname(fileURLToPath(import.meta.url)),
        "../src/simulationLink.ts"
    );
    const source = readFileSync(simulationLinkPath, "utf-8");
    const readOutputCalls = source.match(/this\.results\s*=\s*readOutput\(this\.dataRaw\)/g) ?? [];

    assert(
        readOutputCalls.length === 1,
        `Expected raw output to be parsed once, found ${readOutputCalls.length} readOutput(this.dataRaw) result assignments`
    );
}

function main(): void {
    testRawOutputIsParsedOnce();
    console.log("Raw output single-parse regression test passed");
}

main();
