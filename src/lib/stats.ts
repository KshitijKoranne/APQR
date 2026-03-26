/**
 * QReview Statistical Engine
 * Pharma APQR-specific statistical calculations
 * Implements: Cp, Cpk, Pp, Ppk, UCL/LCL, Nelson's Rules
 */

// ── Basic Statistics ──────────────────────────────────────

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function standardDeviation(values: number[], population = false): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squaredDiffs = values.map((v) => (v - avg) ** 2);
  const divisor = population ? values.length : values.length - 1;
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / divisor);
}

export function rsd(values: number[]): number {
  const avg = mean(values);
  if (avg === 0) return 0;
  return (standardDeviation(values) / avg) * 100;
}

// ── Moving Range (for I-MR charts with individual values) ─

export function movingRanges(values: number[]): number[] {
  const ranges: number[] = [];
  for (let i = 1; i < values.length; i++) {
    ranges.push(Math.abs(values[i] - values[i - 1]));
  }
  return ranges;
}

/**
 * Within-subgroup sigma estimated from average moving range
 * For individual values (1 value per batch): d2 = 1.128 (n=2)
 */
export function sigmaWithin(values: number[]): number {
  const mr = movingRanges(values);
  if (mr.length === 0) return 0;
  const avgMR = mean(mr);
  const d2 = 1.128; // constant for subgroup size n=2
  return avgMR / d2;
}

// ── Process Capability Indices ────────────────────────────

export interface SpecLimits {
  usl?: number | null;
  lsl?: number | null;
  target?: number | null;
}

export interface CapabilityResult {
  n: number;
  mean: number;
  sd: number;
  rsd: number;
  min: number;
  max: number;
  range: number;
  sigmaWithin: number;
  sigmaOverall: number;
  // Capability (short-term, within)
  cp: number | null;
  cpu: number | null;
  cpl: number | null;
  cpk: number | null;
  // Performance (long-term, overall)
  pp: number | null;
  ppu: number | null;
  ppl: number | null;
  ppk: number | null;
  // Control limits (based on within sigma)
  ucl: number;
  lcl: number;
  uwl: number;
  lwl: number;
  // Moving range limits
  mrUcl: number;
  mrMean: number;
  // Status
  cpkStatus: 'capable' | 'marginal' | 'not_capable' | 'insufficient_data';
  // Nelson's rule violations
  nelsonViolations: NelsonViolation[];
}

export function calculateCapability(
  values: number[],
  specs: SpecLimits
): CapabilityResult {
  const n = values.length;
  const avg = mean(values);
  const sd = standardDeviation(values);
  const rsdVal = rsd(values);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const rangeVal = maxVal - minVal;

  const sWithin = sigmaWithin(values);
  const sOverall = sd;

  const { usl, lsl } = specs;

  // Capability indices (within sigma)
  let cp: number | null = null;
  let cpu: number | null = null;
  let cpl: number | null = null;
  let cpk: number | null = null;

  if (sWithin > 0) {
    if (usl != null) cpu = (usl - avg) / (3 * sWithin);
    if (lsl != null) cpl = (avg - lsl) / (3 * sWithin);
    if (usl != null && lsl != null) {
      cp = (usl - lsl) / (6 * sWithin);
      cpk = Math.min(cpu!, cpl!);
    } else if (usl != null) {
      cpk = cpu;
    } else if (lsl != null) {
      cpk = cpl;
    }
  }

  // Performance indices (overall sigma)
  let pp: number | null = null;
  let ppu: number | null = null;
  let ppl: number | null = null;
  let ppk: number | null = null;

  if (sOverall > 0) {
    if (usl != null) ppu = (usl - avg) / (3 * sOverall);
    if (lsl != null) ppl = (avg - lsl) / (3 * sOverall);
    if (usl != null && lsl != null) {
      pp = (usl - lsl) / (6 * sOverall);
      ppk = Math.min(ppu!, ppl!);
    } else if (usl != null) {
      ppk = ppu;
    } else if (lsl != null) {
      ppk = ppl;
    }
  }

  // Control limits (I-chart, based on within sigma)
  const ucl = avg + 3 * sWithin;
  const lcl = avg - 3 * sWithin;
  const uwl = avg + 2 * sWithin;
  const lwl = avg - 2 * sWithin;

  // MR chart limits
  const mr = movingRanges(values);
  const mrMean = mean(mr);
  const D4 = 3.267; // for n=2
  const mrUcl = D4 * mrMean;

  // Cpk status
  let cpkStatus: CapabilityResult['cpkStatus'] = 'insufficient_data';
  if (n >= 10 && cpk != null) {
    if (cpk >= 1.33) cpkStatus = 'capable';
    else if (cpk >= 1.0) cpkStatus = 'marginal';
    else cpkStatus = 'not_capable';
  } else if (n >= 3 && cpk != null) {
    // Allow status with fewer batches but flag
    if (cpk >= 1.33) cpkStatus = 'capable';
    else if (cpk >= 1.0) cpkStatus = 'marginal';
    else cpkStatus = 'not_capable';
  }

  // Nelson's rules
  const nelsonViolations = n >= 3 ? checkNelsonRules(values, avg, sWithin) : [];

  return {
    n, mean: avg, sd, rsd: rsdVal, min: minVal, max: maxVal, range: rangeVal,
    sigmaWithin: sWithin, sigmaOverall: sOverall,
    cp, cpu, cpl, cpk, pp, ppu, ppl, ppk,
    ucl, lcl, uwl, lwl, mrUcl, mrMean,
    cpkStatus, nelsonViolations,
  };
}

// ── Nelson's Rules ────────────────────────────────────────

export interface NelsonViolation {
  rule: number;
  ruleName: string;
  description: string;
  indices: number[]; // batch indices involved
}

export function checkNelsonRules(
  values: number[],
  avg: number,
  sigma: number
): NelsonViolation[] {
  if (sigma === 0 || values.length < 3) return [];

  const violations: NelsonViolation[] = [];

  // Rule 1: Single point > 3σ from mean
  const rule1Indices: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (Math.abs(values[i] - avg) > 3 * sigma) {
      rule1Indices.push(i);
    }
  }
  if (rule1Indices.length > 0) {
    violations.push({
      rule: 1,
      ruleName: 'Beyond 3σ',
      description: 'Point(s) beyond 3 standard deviations from mean',
      indices: rule1Indices,
    });
  }

  // Rule 2: 9 consecutive points on same side of mean
  if (values.length >= 9) {
    for (let i = 0; i <= values.length - 9; i++) {
      const slice = values.slice(i, i + 9);
      const allAbove = slice.every((v) => v > avg);
      const allBelow = slice.every((v) => v < avg);
      if (allAbove || allBelow) {
        const indices = Array.from({ length: 9 }, (_, j) => i + j);
        violations.push({
          rule: 2,
          ruleName: 'Run of 9',
          description: '9 consecutive points on same side of mean (shift/bias)',
          indices,
        });
        break; // report first occurrence
      }
    }
  }

  // Rule 3: 6 consecutive points trending (all increasing or all decreasing)
  if (values.length >= 6) {
    for (let i = 0; i <= values.length - 6; i++) {
      const slice = values.slice(i, i + 6);
      let allIncreasing = true;
      let allDecreasing = true;
      for (let j = 1; j < slice.length; j++) {
        if (slice[j] <= slice[j - 1]) allIncreasing = false;
        if (slice[j] >= slice[j - 1]) allDecreasing = false;
      }
      if (allIncreasing || allDecreasing) {
        const indices = Array.from({ length: 6 }, (_, j) => i + j);
        violations.push({
          rule: 3,
          ruleName: 'Trend of 6',
          description: '6 consecutive points trending in one direction',
          indices,
        });
        break;
      }
    }
  }

  // Rule 5: 2 of 3 consecutive points > 2σ from mean (same side)
  if (values.length >= 3) {
    for (let i = 0; i <= values.length - 3; i++) {
      const slice = values.slice(i, i + 3);
      const above2s = slice.filter((v) => v > avg + 2 * sigma).length;
      const below2s = slice.filter((v) => v < avg - 2 * sigma).length;
      if (above2s >= 2 || below2s >= 2) {
        const indices = Array.from({ length: 3 }, (_, j) => i + j);
        violations.push({
          rule: 5,
          ruleName: '2/3 beyond 2σ',
          description: '2 of 3 consecutive points beyond 2σ on same side',
          indices,
        });
        break;
      }
    }
  }

  return violations;
}

// ── Chart Data Helpers ────────────────────────────────────

export interface ControlChartPoint {
  index: number;
  batchNumber: string;
  value: number;
  ucl: number;
  lcl: number;
  uwl: number;
  lwl: number;
  mean: number;
  usl?: number;
  lsl?: number;
  violatedRules: number[];
}

export function generateControlChartData(
  batchNumbers: string[],
  values: number[],
  capability: CapabilityResult,
  specs: SpecLimits
): ControlChartPoint[] {
  return values.map((value, index) => {
    const violatedRules: number[] = [];
    for (const v of capability.nelsonViolations) {
      if (v.indices.includes(index)) {
        violatedRules.push(v.rule);
      }
    }
    return {
      index,
      batchNumber: batchNumbers[index] || `B${index + 1}`,
      value,
      ucl: capability.ucl,
      lcl: capability.lcl,
      uwl: capability.uwl,
      lwl: capability.lwl,
      mean: capability.mean,
      usl: specs.usl ?? undefined,
      lsl: specs.lsl ?? undefined,
      violatedRules,
    };
  });
}

export interface MRChartPoint {
  index: number;
  batchNumber: string;
  value: number;
  mrUcl: number;
  mrMean: number;
}

export function generateMRChartData(
  batchNumbers: string[],
  values: number[],
  capability: CapabilityResult
): MRChartPoint[] {
  const mr = movingRanges(values);
  return mr.map((value, index) => ({
    index: index + 1,
    batchNumber: batchNumbers[index + 1] || `B${index + 2}`,
    value,
    mrUcl: capability.mrUcl,
    mrMean: capability.mrMean,
  }));
}

// ── Yield Statistics ──────────────────────────────────────

export interface YieldStats {
  n: number;
  mean: number;
  sd: number;
  rsd: number;
  min: number;
  max: number;
  range: number;
  standardYield?: number;
  batchesBelowStandard: number;
}

export function calculateYieldStats(
  yields: number[],
  standardYield?: number
): YieldStats {
  const n = yields.length;
  const avg = mean(yields);
  const sd_ = standardDeviation(yields);
  const rsd_ = rsd(yields);
  const min_ = Math.min(...yields);
  const max_ = Math.max(...yields);

  return {
    n,
    mean: avg,
    sd: sd_,
    rsd: rsd_,
    min: min_,
    max: max_,
    range: max_ - min_,
    standardYield,
    batchesBelowStandard: standardYield
      ? yields.filter((y) => y < standardYield).length
      : 0,
  };
}
