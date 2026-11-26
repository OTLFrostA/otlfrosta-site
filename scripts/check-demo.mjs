import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const dir = fileURLToPath(new URL("../public/demo/", import.meta.url));
const read = name => readFileSync(join(dir, name));
for (const name of ["workbench.png","popup.png","pdf-preview.png"]) {
  const b = read(name);
  assert(b.length > 3000 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), name+" is not a valid PNG artifact");
}
assert.equal(read("solar-energy.pdf").subarray(0,5).toString(),"%PDF-");
for (const name of ["solar-energy.docx","solar-energy.zip","solar-energy-html.zip"]) assert.equal(read(name).subarray(0,2).toString(),"PK");
const sample = JSON.parse(read("solar-energy.json"));
assert.equal(sample.format,"gemini-exporter-domain");
assert.equal(sample.conversation.index.title,"Solar energy at home");
assert(read("solar-energy.md").toString().includes("daily_energy"));
const provenance = JSON.parse(read("provenance.json"));
assert.equal(provenance.version,"2.1.1");
assert.equal(provenance.sourceCommit,"67c7dc5eb5e4d1cac2a8cf0171bf684b1474b152");
assert.equal(provenance.resourceCount,2);
assert.deepEqual(provenance.renderers,["PDF","Word","Markdown","HTML","JSON"]);
console.log("Validated released-renderer demo assets and synthetic provenance.");
