import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    // body.rows: Array of { batch_number, manufacturing_date, status, yield_percentage, [paramName]: value }
    // body.parameterMapping: { [columnName]: parameterId }

    const { rows, parameterMapping } = body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data rows provided' }, { status: 400 });
    }

    const db = await ensureDb();
    const parameters: any[] = db.prepare(
      'SELECT * FROM product_parameters WHERE product_id = ? ORDER BY sort_order'
    ).all(params.id);

    const insertBatch = db.prepare(`
      INSERT OR IGNORE INTO batches (id, product_id, batch_number, manufacturing_date, status, yield_percentage)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertResult = db.prepare(`
      INSERT OR REPLACE INTO batch_results (id, batch_id, parameter_id, value, specification_met, remarks)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const getBatch = db.prepare(
      'SELECT id FROM batches WHERE product_id = ? AND batch_number = ?'
    );

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    const transaction = db.transaction(() => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.batch_number || String(row.batch_number).trim() === '') {
          skipped++;
          continue;
        }

        const batchNumber = String(row.batch_number).trim();
        let batchId: string;

        // Check if batch already exists
        const existing: any = getBatch.get(params.id, batchNumber);
        if (existing) {
          batchId = existing.id;
        } else {
          batchId = uuid();
          try {
            insertBatch.run(
              batchId, params.id, batchNumber,
              row.manufacturing_date || null,
              row.status || 'released',
              row.yield_percentage != null ? Number(row.yield_percentage) : null
            );
          } catch (e: any) {
            errors.push(`Row ${i + 1} (${batchNumber}): ${e.message}`);
            skipped++;
            continue;
          }
        }

        // Insert parameter results
        for (const param of parameters) {
          const colName = parameterMapping?.[param.name] || param.name;
          const rawValue = row[colName] ?? row[param.name];
          if (rawValue == null || rawValue === '' || rawValue === '-') continue;

          const value = Number(rawValue);
          if (isNaN(value)) {
            errors.push(`Row ${i + 1}, ${param.name}: "${rawValue}" is not a number`);
            continue;
          }

          let specMet = 1;
          if (param.usl != null && value > param.usl) specMet = 0;
          if (param.lsl != null && value < param.lsl) specMet = 0;

          try {
            insertResult.run(uuid(), batchId, param.id, value, specMet, null);
          } catch (e: any) {
            // Update existing result
            const existingResult: any = db.prepare(
              'SELECT id FROM batch_results WHERE batch_id = ? AND parameter_id = ?'
            ).get(batchId, param.id);
            if (existingResult) {
              db.prepare(
                'UPDATE batch_results SET value = ?, specification_met = ? WHERE id = ?'
              ).run(value, specMet, existingResult.id);
            }
          }
        }
        imported++;
      }
    });

    transaction();

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 20), // limit error messages
      totalRows: rows.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
