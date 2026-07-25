import { readFileSync, writeFileSync } from "node:fs";
import { init, parseIon, calculateEic } from "quantion";

const DIRECT_BASE = "http://134.115.48.123/converted/MS-AA/";
const PROXY_BASE = "http://localhost:5173/remote/converted/MS-AA/";

const CASES = [
  { label: "Phenylalanine", mz: 336.1343, from: 3.9, to: 4.9, note: "biggest shift (+0.16 min massGen-biogune)" },
  { label: "Histidine", mz: 326.1248, from: 1.9, to: 2.7, note: "anchored (+0.01 min, barely moves)" },
  { label: "Arginine", mz: 345.167, from: 2.1, to: 3.0, note: "reversal (-0.02 min, elutes earlier in massGen)" },
];

const PPM = 20;
const MZ_TOL = 0.005;
const CACHE = 256 * 1024 * 1024;

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function main() {
  const filesPath = arg("files", "../shift-predictor/ml/ltr_files.json");
  const outPath = arg("out", "../shift-predictor/ml/ltr_eics.json");
  const base = process.argv.includes("--proxy") ? PROXY_BASE : arg("base", DIRECT_BASE);

  const samples = JSON.parse(readFileSync(filesPath, "utf8"));
  console.log(`extracting ${CASES.length} EICs from ${samples.length} LTR files via ${base}`);

  await init();

  const traces = {};
  for (const c of CASES) traces[c.label] = [];

  for (const { cohort, file } of samples) {
    const url = base + encodeURIComponent(file);
    let sample;
    try {
      sample = await parseIon(url, { maxCacheSize: CACHE });
    } catch (err) {
      console.error(`  fetch failed ${cohort} ${file}: ${err.message}`);
      continue;
    }
    for (const c of CASES) {
      const eic = await calculateEic(sample, c.mz, { from: c.from, to: c.to }, PPM, MZ_TOL);
      traces[c.label].push({
        cohort,
        file,
        x: Array.from(eic.x, (v) => Number(v.toFixed(4))),
        y: Array.from(eic.y, (v) => Number(v.toFixed(2))),
      });
    }
    console.log(`  ok ${cohort} ${file}`);
  }

  const payload = {
    cases: CASES.map(({ label, mz, from, to, note }) => ({ label, mz, from, to, note })),
    order: ["biogune", "massgen", "mauritius", "heidelberg", "tms"],
    traces,
  };
  writeFileSync(outPath, JSON.stringify(payload));
  console.log(`wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
