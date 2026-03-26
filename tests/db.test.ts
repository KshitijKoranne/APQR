import { getDb } from '../src/lib/db';
import { v4 as uuid } from 'uuid';
import { calculateCapability, generateControlChartData } from '../src/lib/stats';

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.error(`  ✗ FAIL: ${msg}`); }
}

console.log('\n═══ DATABASE LAYER TESTS ═══');

const db = getDb();

// Check tables exist
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
assert(tables.includes('products'), 'products table exists');
assert(tables.includes('product_parameters'), 'product_parameters table exists');
assert(tables.includes('batches'), 'batches table exists');
assert(tables.includes('batch_results'), 'batch_results table exists');
assert(tables.includes('deviations'), 'deviations table exists');
assert(tables.includes('change_controls'), 'change_controls table exists');
assert(tables.includes('capas'), 'capas table exists');
assert(tables.includes('complaints'), 'complaints table exists');
assert(tables.includes('oos_results'), 'oos_results table exists');
assert(tables.includes('apqr_reports'), 'apqr_reports table exists');

console.log('\n═══ CRUD OPERATIONS ═══');

// Create product
const productId = uuid();
db.prepare(`INSERT INTO products (id, name, code, generic_name, api_grade, standard_yield, status) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  .run(productId, 'Test API', 'TEST-001', 'Test Generic', 'USP', 85.0, 'active');

const product: any = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
assert(product !== undefined, 'Product inserted');
assert(product.name === 'Test API', 'Product name correct');
assert(product.standard_yield === 85.0, 'Standard yield correct');

// Create parameters
const paramId1 = uuid();
const paramId2 = uuid();
db.prepare(`INSERT INTO product_parameters (id, product_id, name, type, unit, usl, lsl, target, is_critical) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(paramId1, productId, 'Assay', 'cqa', '%', 101.0, 98.0, 99.5, 1);
db.prepare(`INSERT INTO product_parameters (id, product_id, name, type, unit, usl, lsl, target, is_critical) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  .run(paramId2, productId, 'Water Content', 'cqa', '% w/w', 0.5, null, 0.2, 1);

const params: any[] = db.prepare('SELECT * FROM product_parameters WHERE product_id = ?').all(productId);
assert(params.length === 2, 'Two parameters created');
assert(params[0].usl === 101.0, 'Assay USL correct');
assert(params[1].lsl === null, 'Water Content LSL is null (one-sided)');

// Create batches with results
const batchValues = [
  { num: 'TST-001', date: '2025-01-15', yield: 84.5, assay: 99.2, water: 0.22 },
  { num: 'TST-002', date: '2025-02-10', yield: 85.1, assay: 99.5, water: 0.25 },
  { num: 'TST-003', date: '2025-03-05', yield: 83.8, assay: 99.8, water: 0.18 },
  { num: 'TST-004', date: '2025-04-12', yield: 86.0, assay: 99.1, water: 0.30 },
  { num: 'TST-005', date: '2025-05-20', yield: 84.2, assay: 99.6, water: 0.20 },
  { num: 'TST-006', date: '2025-06-08', yield: 85.5, assay: 99.3, water: 0.23 },
  { num: 'TST-007', date: '2025-07-15', yield: 84.0, assay: 99.7, water: 0.19 },
  { num: 'TST-008', date: '2025-08-01', yield: 85.8, assay: 99.4, water: 0.28 },
  { num: 'TST-009', date: '2025-09-10', yield: 84.3, assay: 99.9, water: 0.21 },
  { num: 'TST-010', date: '2025-10-05', yield: 85.2, assay: 99.5, water: 0.24 },
  { num: 'TST-011', date: '2025-11-12', yield: 86.1, assay: 99.6, water: 0.17 },
  { num: 'TST-012', date: '2025-12-01', yield: 85.0, assay: 99.2, water: 0.26 },
];

const batchIds: string[] = [];
for (const bv of batchValues) {
  const batchId = uuid();
  batchIds.push(batchId);
  db.prepare(`INSERT INTO batches (id, product_id, batch_number, manufacturing_date, status, yield_percentage)
    VALUES (?, ?, ?, ?, ?, ?)`).run(batchId, productId, bv.num, bv.date, 'released', bv.yield);

  // Assay result
  let specMet = (bv.assay >= 98.0 && bv.assay <= 101.0) ? 1 : 0;
  db.prepare(`INSERT INTO batch_results (id, batch_id, parameter_id, value, specification_met) VALUES (?, ?, ?, ?, ?)`)
    .run(uuid(), batchId, paramId1, bv.assay, specMet);

  // Water content result
  specMet = bv.water <= 0.5 ? 1 : 0;
  db.prepare(`INSERT INTO batch_results (id, batch_id, parameter_id, value, specification_met) VALUES (?, ?, ?, ?, ?)`)
    .run(uuid(), batchId, paramId2, bv.water, specMet);
}

const batches: any[] = db.prepare('SELECT * FROM batches WHERE product_id = ? ORDER BY manufacturing_date').all(productId);
assert(batches.length === 12, '12 batches created');

const results: any[] = db.prepare(`
  SELECT br.*, pp.name as param_name FROM batch_results br
  JOIN product_parameters pp ON br.parameter_id = pp.id
  WHERE br.batch_id IN (${batchIds.map(() => '?').join(',')})
`).all(...batchIds);
assert(results.length === 24, '24 batch results (12 batches × 2 params)');

console.log('\n═══ STATISTICAL ANALYSIS ON DB DATA ═══');

// Query assay values from DB
const assayResults: any[] = db.prepare(`
  SELECT br.value, b.batch_number FROM batch_results br
  JOIN batches b ON br.batch_id = b.id
  WHERE br.parameter_id = ? ORDER BY b.manufacturing_date
`).all(paramId1);

const assayValues = assayResults.map((r: any) => r.value);
const assayBatchNums = assayResults.map((r: any) => r.batch_number);

const cap = calculateCapability(assayValues, { usl: 101.0, lsl: 98.0, target: 99.5 });
assert(cap.n === 12, 'Stats computed on 12 batch assay values');
assert(cap.cpk !== null && cap.cpk > 1.0, `Assay Cpk > 1: ${cap.cpk?.toFixed(3)}`);
assert(cap.cpkStatus === 'capable' || cap.cpkStatus === 'marginal', `Assay status: ${cap.cpkStatus}`);

const chartData = generateControlChartData(assayBatchNums, assayValues, cap, { usl: 101.0, lsl: 98.0 });
assert(chartData.length === 12, 'Chart data generated for 12 points');
assert(chartData[0].batchNumber === 'TST-001', 'Chart data batch number correct');
assert(chartData[0].ucl > chartData[0].mean, 'Chart UCL > mean');

console.log(`  → Assay: Cpk=${cap.cpk?.toFixed(3)}, Mean=${cap.mean.toFixed(3)}, UCL=${cap.ucl.toFixed(3)}, LCL=${cap.lcl.toFixed(3)}`);

// Water content (one-sided)
const waterResults: any[] = db.prepare(`
  SELECT br.value FROM batch_results br JOIN batches b ON br.batch_id = b.id
  WHERE br.parameter_id = ? ORDER BY b.manufacturing_date
`).all(paramId2);

const waterValues = waterResults.map((r: any) => r.value);
const capW = calculateCapability(waterValues, { usl: 0.5, lsl: null, target: 0.2 });
assert(capW.cp === null, 'Water Cp is null (one-sided)');
assert(capW.cpk !== null && capW.cpk > 0, `Water Cpk > 0: ${capW.cpk?.toFixed(3)}`);
console.log(`  → Water: Cpk=${capW.cpk?.toFixed(3)} (one-sided, USL only)`);

console.log('\n═══ DEVIATIONS / CAPAS / CC ═══');

// Insert a deviation
const devId = uuid();
db.prepare(`INSERT INTO deviations (id, product_id, batch_id, deviation_number, type, description, investigation_status, date_raised)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(devId, productId, batchIds[3], 'DEV-TEST-001', 'major', 'Test deviation', 'open', '2025-04-15');

const devs: any[] = db.prepare('SELECT * FROM deviations WHERE product_id = ?').all(productId);
assert(devs.length === 1, 'Deviation created');
assert(devs[0].type === 'major', 'Deviation type correct');

// Insert CAPA
db.prepare(`INSERT INTO capas (id, product_id, capa_number, description, status, due_date) VALUES (?, ?, ?, ?, ?, ?)`)
  .run(uuid(), productId, 'CAPA-TEST-001', 'Test CAPA', 'open', '2025-06-30');

const capas: any[] = db.prepare('SELECT * FROM capas WHERE product_id = ?').all(productId);
assert(capas.length === 1, 'CAPA created');

// Insert Change Control
db.prepare(`INSERT INTO change_controls (id, product_id, cc_number, description, type, status) VALUES (?, ?, ?, ?, ?, ?)`)
  .run(uuid(), productId, 'CC-TEST-001', 'Test CC', 'process', 'implemented');

const ccs: any[] = db.prepare('SELECT * FROM change_controls WHERE product_id = ?').all(productId);
assert(ccs.length === 1, 'Change control created');

console.log('\n═══ BATCH SUMMARY QUERY ═══');

const summary: any = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN status = 'released' THEN 1 ELSE 0 END) as released,
    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
    SUM(CASE WHEN status = 'reprocessed' THEN 1 ELSE 0 END) as reprocessed
  FROM batches WHERE product_id = ?
`).get(productId);

assert(summary.total === 12, `Batch summary total = 12`);
assert(summary.released === 12, `All 12 released`);

// Clean up test data
db.prepare('DELETE FROM products WHERE id = ?').run(productId);

const afterDelete: any = db.prepare('SELECT COUNT(*) as c FROM batches WHERE product_id = ?').get(productId);
assert(afterDelete.c === 0, 'CASCADE delete removed batches');

const afterDeleteResults: any = db.prepare(`SELECT COUNT(*) as c FROM batch_results WHERE batch_id IN (${batchIds.map(() => '?').join(',')})`).get(...batchIds);
assert(afterDeleteResults.c === 0, 'CASCADE delete removed batch_results');

console.log('\n═══════════════════════════════════════════');
console.log(`\n  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);
if (failed > 0) process.exit(1);
