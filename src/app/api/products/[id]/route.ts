import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(params.id);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const parameters = db.prepare(
      'SELECT * FROM product_parameters WHERE product_id = ? ORDER BY sort_order, name'
    ).all(params.id);

    const batches = db.prepare(
      'SELECT * FROM batches WHERE product_id = ? ORDER BY manufacturing_date DESC, batch_number'
    ).all(params.id);

    const batchSummary = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'released' THEN 1 ELSE 0 END) as released,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'reprocessed' THEN 1 ELSE 0 END) as reprocessed,
        SUM(CASE WHEN status = 'under_process' THEN 1 ELSE 0 END) as under_process
      FROM batches WHERE product_id = ?
    `).get(params.id);

    const deviations = db.prepare(
      'SELECT * FROM deviations WHERE product_id = ? ORDER BY date_raised DESC'
    ).all(params.id);

    const capas = db.prepare(
      'SELECT * FROM capas WHERE product_id = ? ORDER BY created_at DESC'
    ).all(params.id);

    const changeControls = db.prepare(
      'SELECT * FROM change_controls WHERE product_id = ? ORDER BY created_at DESC'
    ).all(params.id);

    const complaints = db.prepare(
      'SELECT * FROM complaints WHERE product_id = ? ORDER BY date_received DESC'
    ).all(params.id);

    return NextResponse.json({
      ...product as any,
      parameters,
      batches,
      batchSummary,
      deviations,
      capas,
      changeControls,
      complaints,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const db = getDb();

    db.prepare(`
      UPDATE products SET name=?, code=?, generic_name=?, api_grade=?, batch_size=?, 
        batch_size_unit=?, shelf_life_months=?, license_no=?, standard_yield=?, 
        therapeutic_category=?, updated_at=datetime('now')
      WHERE id = ?
    `).run(
      body.name, body.code, body.generic_name, body.api_grade,
      body.batch_size, body.batch_size_unit, body.shelf_life_months,
      body.license_no, body.standard_yield, body.therapeutic_category,
      params.id
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(params.id);
    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getDb();
    db.prepare('DELETE FROM products WHERE id = ?').run(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
