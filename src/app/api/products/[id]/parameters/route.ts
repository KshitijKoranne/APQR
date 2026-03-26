import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await ensureDb();
    const parameters = db.prepare(
      'SELECT * FROM product_parameters WHERE product_id = ? ORDER BY sort_order, name'
    ).all(params.id);
    return NextResponse.json(parameters);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const db = await ensureDb();
    const id = uuid();

    const maxOrder: any = db.prepare(
      'SELECT MAX(sort_order) as max_order FROM product_parameters WHERE product_id = ?'
    ).get(params.id);

    db.prepare(`
      INSERT INTO product_parameters (id, product_id, name, type, unit, usl, lsl, target, stage, is_critical, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, params.id, body.name, body.type || 'cqa', body.unit || null,
      body.usl ?? null, body.lsl ?? null, body.target ?? null,
      body.stage || null, body.is_critical ?? 1,
      (maxOrder?.max_order ?? -1) + 1
    );

    const param = db.prepare('SELECT * FROM product_parameters WHERE id = ?').get(id);
    db.save();
    return NextResponse.json(param, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const db = await ensureDb();

    if (!body.param_id) {
      return NextResponse.json({ error: 'param_id required' }, { status: 400 });
    }

    db.prepare(`
      UPDATE product_parameters SET name=?, type=?, unit=?, usl=?, lsl=?, target=?, stage=?, is_critical=?
      WHERE id = ? AND product_id = ?
    `).run(
      body.name, body.type, body.unit, body.usl ?? null, body.lsl ?? null,
      body.target ?? null, body.stage, body.is_critical ?? 1,
      body.param_id, params.id
    );

    const param = db.prepare('SELECT * FROM product_parameters WHERE id = ?').get(body.param_id);
    return NextResponse.json(param);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(req.url);
    const paramId = searchParams.get('paramId');
    if (!paramId) return NextResponse.json({ error: 'paramId required' }, { status: 400 });

    const db = await ensureDb();
    db.prepare('DELETE FROM product_parameters WHERE id = ? AND product_id = ?').run(paramId, params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
