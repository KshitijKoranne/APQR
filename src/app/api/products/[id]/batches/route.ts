import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await ensureDb();
    const batches = db.prepare(`
      SELECT b.*, 
        (SELECT COUNT(*) FROM batch_results br WHERE br.batch_id = b.id) as result_count
      FROM batches b WHERE b.product_id = ? 
      ORDER BY b.manufacturing_date ASC, b.batch_number
    `).all(params.id);

    // Get all results for all batches
    const batchIds = (batches as any[]).map((b: any) => b.id);
    let results: any[] = [];
    if (batchIds.length > 0) {
      results = db.prepare(`
        SELECT br.*, pp.name as parameter_name, pp.unit, pp.usl, pp.lsl, pp.target, pp.type as param_type, pp.stage
        FROM batch_results br
        JOIN product_parameters pp ON br.parameter_id = pp.id
        WHERE br.batch_id IN (${batchIds.map(() => '?').join(',')})
        ORDER BY pp.sort_order
      `).all(...batchIds);
    }

    return NextResponse.json({ batches, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const db = await ensureDb();
    const batchId = uuid();

    db.prepare(`
      INSERT INTO batches (id, product_id, batch_number, manufacturing_date, status, yield_percentage, remarks)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      batchId, params.id, body.batch_number, body.manufacturing_date || null,
      body.status || 'released', body.yield_percentage ?? null, body.remarks || null
    );

    // Insert results if provided
    if (body.results && Array.isArray(body.results)) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO batch_results (id, batch_id, parameter_id, value, specification_met, remarks)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const r of body.results) {
        // Check spec compliance
        const param: any = db.prepare('SELECT * FROM product_parameters WHERE id = ?').get(r.parameter_id);
        let specMet = 1;
        if (param) {
          if (param.usl != null && r.value > param.usl) specMet = 0;
          if (param.lsl != null && r.value < param.lsl) specMet = 0;
        }
        stmt.run(uuid(), batchId, r.parameter_id, r.value, specMet, r.remarks || null);
      }
    }

    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
    db.save();
    return NextResponse.json(batch, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId');
    if (!batchId) return NextResponse.json({ error: 'batchId required' }, { status: 400 });

    const db = await ensureDb();
    db.prepare('DELETE FROM batches WHERE id = ? AND product_id = ?').run(batchId, params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
