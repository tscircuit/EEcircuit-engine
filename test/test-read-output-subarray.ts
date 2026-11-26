import assert from "node:assert/strict";
import { readOutput } from "../src/readOutput.ts";

function subarrayRawOutput(): Uint8Array {
    const header = [
        "EEcircuit test",
        "Date: Tue Nov 24 00:00:00 2026",
        "Plotname: Transient Analysis",
        "Flags: real",
        "No. Variables: 2",
        "No. Points: 2",
        "Variables:",
        "0 time time",
        "1 v(out) voltage",
        "Binary:",
        "",
    ].join("\n");
    const headerBytes = new TextEncoder().encode(header);
    const binary = new Uint8Array(4 * 8);
    const view = new DataView(binary.buffer);
    [0, 1.5, 1, 2.5].forEach((value, index) => {
        view.setFloat64(index * 8, value, true);
    });

    const backing = new Uint8Array(13 + headerBytes.length + binary.length);
    backing.fill(255, 0, 13);
    backing.set(headerBytes, 13);
    backing.set(binary, 13 + headerBytes.length);
    return backing.subarray(13);
}

const result = readOutput(subarrayRawOutput());
assert.equal(result.dataType, "real");
if (result.dataType !== "real") throw new Error("expected real data");
assert.deepEqual(result.data[0].values, [0, 1]);
assert.deepEqual(result.data[1].values, [1.5, 2.5]);
console.log("readOutput subarray regression test passed");
