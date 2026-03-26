import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await ensureDb();
    const deviations = db.prepare(
      'SELECT d.*, b.batch_number FROM deviations d LEFT JOIN batches b ON d.batch_id = b.id WHERE d.product_id = ? ORDER BY d.date_raised DESC'
    ).all(params.id);
    return NextResponse.json(deviations);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const db = await ensureDb();
    const id = uuid();
    db.prepare(`
      INSERT INTO deviations (id, product_id, batch_id, deviation_number, type, description, root_cause, capa_reference, investigation_status, date_raised, date_closed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.id, body.batch_id || null, body.deviation_number, body.type || 'minor',
      body.description, body.root_cause || null, body.capa_reference || null,
      body.investigation_status || 'open', body.date_raised || null, body.date_closed || null);
    const dev = db.prepare('SELECT * FROM deviations WHERE id = ?').get(id);
    return NextResponse.json(dev, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
