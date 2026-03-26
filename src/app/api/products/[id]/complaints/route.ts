import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await ensureDb();
    const complaints = db.prepare('SELECT * FROM complaints WHERE product_id = ? ORDER BY date_received DESC').all(params.id);
    return NextResponse.json(complaints);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const db = await ensureDb();
    const id = uuid();
    db.prepare(`
      INSERT INTO complaints (id, product_id, batch_id, complaint_number, type, description, investigation_summary, capa_reference, date_received, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.id, body.batch_id || null, body.complaint_number, body.type || 'customer',
      body.description, body.investigation_summary || null, body.capa_reference || null,
      body.date_received || null, body.status || 'open');
    const c = db.prepare('SELECT * FROM complaints WHERE id = ?').get(id);
    return NextResponse.json(c, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
