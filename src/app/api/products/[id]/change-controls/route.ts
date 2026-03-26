import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await ensureDb();
    const ccs = db.prepare('SELECT * FROM change_controls WHERE product_id = ? ORDER BY created_at DESC').all(params.id);
    return NextResponse.json(ccs);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const db = await ensureDb();
    const id = uuid();
    db.prepare(`
      INSERT INTO change_controls (id, product_id, cc_number, description, type, impact_assessment, effective_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.id, body.cc_number, body.description, body.type || 'process',
      body.impact_assessment || null, body.effective_date || null, body.status || 'open');
    const cc = db.prepare('SELECT * FROM change_controls WHERE id = ?').get(id);
    return NextResponse.json(cc, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
