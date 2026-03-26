import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await ensureDb();
    const capas = db.prepare('SELECT * FROM capas WHERE product_id = ? ORDER BY created_at DESC').all(params.id);
    return NextResponse.json(capas);
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const db = await ensureDb();
    const id = uuid();
    db.prepare(`
      INSERT INTO capas (id, product_id, capa_number, source_type, source_reference, description, action_taken, due_date, closure_date, effectiveness_review, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.id, body.capa_number, body.source_type || null, body.source_reference || null,
      body.description, body.action_taken || null, body.due_date || null,
      body.closure_date || null, body.effectiveness_review || null, body.status || 'open');
    const capa = db.prepare('SELECT * FROM capas WHERE id = ?').get(id);
    return NextResponse.json(capa, { status: 201 });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
