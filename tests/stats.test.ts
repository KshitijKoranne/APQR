import {
  mean, standardDeviation, rsd, movingRanges, sigmaWithin,
  calculateCapability, checkNelsonRules, calculateYieldStats,
  SpecLimits
} from '../src/lib/stats';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ FAIL: ${msg}`); }
}

function approxEqual(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) < tolerance;
}

// ══════════════════════════════════════════════════════
console.log('\n═══ BASIC STATISTICS ═══');

assert(mean([1, 2, 3, 4, 5]) === 3, 'mean([1,2,3,4,5]) = 3');
assert(mean([100]) === 100, 'mean([100]) = 100');
assert(mean([]) === 0, 'mean([]) = 0');

const sd1 = standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]);
assert(approxEqual(sd1, 2.138, 0.01), `SD of sample = ${sd1.toFixed(4)} ≈ 2.138`);

const rsd1 = rsd([99.2, 99.5, 99.8, 99.1, 99.6]);
assert(rsd1 > 0 && rsd1 < 1, `RSD = ${rsd1.toFixed(4)}% (should be <1% for tight data)`);

// ══════════════════════════════════════════════════════
console.log('\n═══ MOVING RANGES ═══');

const mr = movingRanges([10, 12, 11, 14, 13]);
assert(mr.length === 4, `Moving ranges count = ${mr.length}`);
assert(mr[0] === 2, `MR[0] = |12-10| = 2`);
assert(mr[1] === 1, `MR[1] = |11-12| = 1`);
assert(mr[2] === 3, `MR[2] = |14-11| = 3`);

const sw = sigmaWithin([10, 12, 11, 14, 13]);
assert(sw > 0, `sigmaWithin > 0: ${sw.toFixed(4)}`);

// ══════════════════════════════════════════════════════
console.log('\n═══ PROCESS CAPABILITY - TWO-SIDED SPEC ═══');

// Known dataset: mean=99.5, USL=101, LSL=98
const assayValues = [99.2, 99.5, 99.8, 99.1, 99.6, 99.3, 99.7, 99.4, 99.9, 99.5,
                     99.6, 99.2, 99.8, 99.0, 99.7, 99.3, 99.5, 99.4, 99.6, 99.1];
const assaySpecs: SpecLimits = { usl: 101.0, lsl: 98.0, target: 99.5 };

const cap = calculateCapability(assayValues, assaySpecs);

assert(cap.n === 20, `n = 20`);
assert(approxEqual(cap.mean, 99.47, 0.1), `mean ≈ 99.47: ${cap.mean.toFixed(4)}`);
assert(cap.sd > 0, `SD > 0: ${cap.sd.toFixed(4)}`);
assert(cap.sigmaWithin > 0, `sigmaWithin > 0: ${cap.sigmaWithin.toFixed(4)}`);

// Cp should be > 1 for this tight data within spec
assert(cap.cp !== null && cap.cp > 1, `Cp > 1: ${cap.cp?.toFixed(4)}`);
assert(cap.cpk !== null && cap.cpk > 1, `Cpk > 1: ${cap.cpk?.toFixed(4)}`);
assert(cap.cpu !== null && cap.cpu > 0, `CPU > 0: ${cap.cpu?.toFixed(4)}`);
assert(cap.cpl !== null && cap.cpl > 0, `CPL > 0: ${cap.cpl?.toFixed(4)}`);

// Ppk
assert(cap.pp !== null && cap.pp > 1, `Pp > 1: ${cap.pp?.toFixed(4)}`);
assert(cap.ppk !== null && cap.ppk > 1, `Ppk > 1: ${cap.ppk?.toFixed(4)}`);

// Control limits
assert(cap.ucl > cap.mean, `UCL > mean: ${cap.ucl.toFixed(4)}`);
assert(cap.lcl < cap.mean, `LCL < mean: ${cap.lcl.toFixed(4)}`);
assert(cap.uwl > cap.mean && cap.uwl < cap.ucl, `UWL between mean and UCL`);

// Cpk status
assert(cap.cpkStatus === 'capable' || cap.cpkStatus === 'marginal', `cpkStatus = ${cap.cpkStatus}`);

console.log(`  → Cp=${cap.cp?.toFixed(3)}, Cpk=${cap.cpk?.toFixed(3)}, Pp=${cap.pp?.toFixed(3)}, Ppk=${cap.ppk?.toFixed(3)}`);
console.log(`  → UCL=${cap.ucl.toFixed(3)}, LCL=${cap.lcl.toFixed(3)}, Mean=${cap.mean.toFixed(3)}`);

// ══════════════════════════════════════════════════════
console.log('\n═══ PROCESS CAPABILITY - ONE-SIDED SPEC (USL only) ═══');

// Water content: USL=0.5, no LSL (common in API)
const waterValues = [0.22, 0.25, 0.18, 0.30, 0.20, 0.23, 0.19, 0.28, 0.21, 0.24];
const waterSpecs: SpecLimits = { usl: 0.5, lsl: null, target: 0.2 };

const capWater = calculateCapability(waterValues, waterSpecs);

assert(capWater.cp === null, 'Cp is null for one-sided spec');
assert(capWater.cpk !== null && capWater.cpk > 0, `Cpk (one-sided) > 0: ${capWater.cpk?.toFixed(4)}`);
assert(capWater.cpl === null, 'CPL is null (no LSL)');
assert(capWater.cpu !== null && capWater.cpu > 0, `CPU > 0: ${capWater.cpu?.toFixed(4)}`);
console.log(`  → One-sided Cpk=${capWater.cpk?.toFixed(3)} (USL only)`);

// ══════════════════════════════════════════════════════
console.log('\n═══ PROCESS CAPABILITY - NOT CAPABLE PROCESS ═══');

// Wide variation, tight spec
const badProcess = [97.0, 102.0, 98.5, 101.5, 96.5, 103.0, 99.0, 100.5, 97.5, 101.0];
const tightSpecs: SpecLimits = { usl: 101.0, lsl: 99.0 };

const capBad = calculateCapability(badProcess, tightSpecs);
assert(capBad.cpk !== null && capBad.cpk < 1.0, `Cpk < 1 for bad process: ${capBad.cpk?.toFixed(4)}`);
assert(capBad.cpkStatus === 'not_capable', `Status is not_capable: ${capBad.cpkStatus}`);
console.log(`  → Bad process Cpk=${capBad.cpk?.toFixed(3)}, Status=${capBad.cpkStatus}`);

// ══════════════════════════════════════════════════════
console.log('\n═══ NELSON\'S RULES ═══');

// Rule 1: Point beyond 3σ
const rule1Data = [10, 10, 10, 10, 10, 10, 10, 10, 10, 25]; // outlier at end
const r1avg = mean(rule1Data);
const r1sig = sigmaWithin(rule1Data);
const r1v = checkNelsonRules(rule1Data, r1avg, r1sig);
const r1hit = r1v.some(v => v.rule === 1);
assert(r1hit, `Rule 1 detects outlier (value=25 in [10,10,...,10])`);

// Rule 2: 9 consecutive on same side
const rule2Data = [10, 11, 12, 11, 10, 11, 12, 11, 10, 5, 5, 5, 5, 5, 5, 5, 5, 5]; // last 9 below mean
const r2avg = mean(rule2Data);
const r2sig = sigmaWithin(rule2Data);
const r2v = checkNelsonRules(rule2Data, r2avg, r2sig);
const r2hit = r2v.some(v => v.rule === 2);
assert(r2hit, `Rule 2 detects 9 consecutive points below mean`);

// Rule 3: 6 consecutive trending
const rule3Data = [10, 10, 10, 11, 12, 13, 14, 15, 16, 10]; // 6 increasing from index 3-8
const r3avg = mean(rule3Data);
const r3sig = sigmaWithin(rule3Data);
const r3v = checkNelsonRules(rule3Data, r3avg, r3sig);
const r3hit = r3v.some(v => v.rule === 3);
assert(r3hit, `Rule 3 detects 6-point trend`);

// No violations for random normal data
const normalData = [99.5, 99.3, 99.7, 99.4, 99.6, 99.5, 99.3, 99.8, 99.2, 99.6];
const navg = mean(normalData);
const nsig = sigmaWithin(normalData);
const nv = checkNelsonRules(normalData, navg, nsig);
// May or may not have violations due to randomness, but should have few
assert(nv.length <= 2, `Normal data has ≤2 violations: ${nv.length}`);
console.log(`  → Normal data violations: ${nv.length}`);

// ══════════════════════════════════════════════════════
console.log('\n═══ YIELD STATISTICS ═══');

const yields = [82.5, 84.1, 85.0, 83.2, 86.0, 81.5, 84.8, 85.5, 83.0, 84.5];
const ys = calculateYieldStats(yields, 85.0);
assert(approxEqual(ys.mean, 83.91, 0.2), `Mean yield ≈ 83.91: ${ys.mean.toFixed(2)}`);
assert(ys.sd > 0, `Yield SD > 0: ${ys.sd.toFixed(2)}`);
assert(ys.batchesBelowStandard > 0, `Some batches below standard: ${ys.batchesBelowStandard}`);
assert(ys.n === 10, `n = 10`);

// ══════════════════════════════════════════════════════
console.log('\n═══ EDGE CASES ═══');

// Empty data
const capEmpty = calculateCapability([], { usl: 100, lsl: 90 });
assert(capEmpty.n === 0, 'Empty data: n = 0');
assert(capEmpty.cpk === null, 'Empty data: cpk = null');

// Single value
const capSingle = calculateCapability([99.5], { usl: 101, lsl: 98 });
assert(capSingle.n === 1, 'Single value: n = 1');
assert(capSingle.cpkStatus === 'insufficient_data', 'Single value: insufficient_data');

// Identical values (zero variance)
const capIdentical = calculateCapability([100, 100, 100, 100, 100], { usl: 101, lsl: 99 });
assert(capIdentical.sd === 0, 'Identical values: SD = 0');
assert(capIdentical.cpk === null, 'Identical values: cpk = null (zero sigma)');

// No spec limits
const capNoSpec = calculateCapability([99, 100, 101], { usl: null, lsl: null });
assert(capNoSpec.cp === null, 'No specs: Cp = null');
assert(capNoSpec.cpk === null, 'No specs: Cpk = null');

// ══════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════');
console.log(`\n  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);
if (failed > 0) process.exit(1);
