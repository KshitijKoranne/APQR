import { ensureDb, resetAndSeed } from '../src/lib/db';

async function test() {
  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✓ ${m}`); } else { failed++; console.error(`  ✗ FAIL: ${m}`); } };

  console.log('\n═══ SQL.JS DATABASE TESTS ═══');

  const db = await ensureDb();
  assert(db !== null, 'Database initialized');

  // Check auto-seeded data
  const products: any[] = db.prepare('SELECT * FROM products').all();
  assert(products.length === 2, `2 products seeded: got ${products.length}`);
  assert(products[0].name === 'Metformin Hydrochloride', `First product: ${products[0].name}`);

  const batches: any[] = db.prepare('SELECT * FROM batches WHERE product_id = ?').all(products[0].id);
  assert(batches.length === 25, `25 Metformin batches: got ${batches.length}`);

  const params: any[] = db.prepare('SELECT * FROM product_parameters WHERE product_id = ?').all(products[0].id);
  assert(params.length === 8, `8 Metformin parameters: got ${params.length}`);

  const results: any[] = db.prepare('SELECT COUNT(*) as c FROM batch_results WHERE batch_id = ?').all(batches[0].id);
  assert(results[0].c === 8, `8 results per batch: got ${results[0].c}`);

  const devs: any[] = db.prepare('SELECT * FROM deviations WHERE product_id = ?').all(products[0].id);
  assert(devs.length === 5, `5 deviations: got ${devs.length}`);

  const capas: any[] = db.prepare('SELECT * FROM capas WHERE product_id = ?').all(products[0].id);
  assert(capas.length === 4, `4 CAPAs: got ${capas.length}`);

  const ccs: any[] = db.prepare('SELECT * FROM change_controls WHERE product_id = ?').all(products[0].id);
  assert(ccs.length === 3, `3 change controls: got ${ccs.length}`);

  const comps: any[] = db.prepare('SELECT * FROM complaints WHERE product_id = ?').all(products[0].id);
  assert(comps.length === 2, `2 complaints: got ${comps.length}`);

  // Test stats query (the key API path)
  console.log('\n═══ STATS QUERY TEST ═══');
  const assayParam = params.find((p: any) => p.name === 'Assay');
  assert(assayParam !== undefined, 'Assay parameter found');

  const assayResults: any[] = db.prepare(`
    SELECT br.value, b.batch_number FROM batch_results br
    JOIN batches b ON br.batch_id = b.id
    WHERE br.parameter_id = ? ORDER BY b.manufacturing_date
  `).all(assayParam.id);
  assert(assayResults.length === 25, `25 assay results: got ${assayResults.length}`);

  // Verify batch 7 has failed assay
  const batch7 = batches.find((b: any) => b.batch_number === 'MET-007-25');
  assert(batch7 !== undefined, 'Batch MET-007-25 exists');
  assert(batch7.status === 'rejected', `MET-007-25 is rejected: ${batch7.status}`);

  const b7assay: any = db.prepare('SELECT value FROM batch_results WHERE batch_id = ? AND parameter_id = ?').get(batch7.id, assayParam.id);
  assert(b7assay && b7assay.value === 97.5, `MET-007-25 assay = 97.5: got ${b7assay?.value}`);

  // Test INSERT (manual batch entry)
  console.log('\n═══ WRITE TEST ═══');
  const uid = () => 'test-' + Math.random().toString(36).substring(2, 10);
  const newBatchId = uid();
  db.prepare(`INSERT INTO batches (id, product_id, batch_number, manufacturing_date, status, yield_percentage) VALUES (?,?,?,?,?,?)`)
    .run(newBatchId, products[0].id, 'TEST-MANUAL-001', '2025-12-20', 'released', 86.5);

  const newBatch: any = db.prepare('SELECT * FROM batches WHERE id = ?').get(newBatchId);
  assert(newBatch !== undefined, 'Manual batch inserted');
  assert(newBatch.yield_percentage === 86.5, `Yield = 86.5: got ${newBatch.yield_percentage}`);

  // Insert result for it
  db.prepare(`INSERT INTO batch_results (id, batch_id, parameter_id, value, specification_met) VALUES (?,?,?,?,?)`)
    .run(uid(), newBatchId, assayParam.id, 99.7, 1);

  const newResult: any = db.prepare('SELECT value FROM batch_results WHERE batch_id = ? AND parameter_id = ?').get(newBatchId, assayParam.id);
  assert(newResult && newResult.value === 99.7, `Result value = 99.7: got ${newResult?.value}`);

  // Product 2 check
  console.log('\n═══ PRODUCT 2 CHECK ═══');
  const p2 = products.find((p: any) => p.code === 'ATV-API-001');
  assert(p2 !== undefined, 'Atorvastatin product exists');
  const p2Batches: any[] = db.prepare('SELECT * FROM batches WHERE product_id = ?').all(p2.id);
  assert(p2Batches.length === 12, `12 Atorvastatin batches: got ${p2Batches.length}`);

  // Reset test
  console.log('\n═══ RESET & RESEED ═══');
  resetAndSeed();
  const afterReset: any[] = db.prepare('SELECT * FROM products').all();
  assert(afterReset.length === 2, `After reset: 2 products: got ${afterReset.length}`);

  // Clean up test batch
  db.prepare('DELETE FROM batches WHERE batch_number = ?').run('TEST-MANUAL-001');

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`\n  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);
  if (failed > 0) process.exit(1);
}

test().catch(e => { console.error(e); process.exit(1); });
