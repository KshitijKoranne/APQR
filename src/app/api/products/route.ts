import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const db = await ensureDb();
    const products = db.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM batches b WHERE b.product_id = p.id) as batch_count,
        (SELECT COUNT(*) FROM product_parameters pp WHERE pp.product_id = p.id) as param_count
      FROM products p ORDER BY p.created_at DESC
    `).all();
    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = await ensureDb();
    const id = uuid();

    db.prepare(`
      INSERT INTO products (id, name, code, generic_name, api_grade, batch_size, batch_size_unit, shelf_life_months, license_no, standard_yield, therapeutic_category)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, body.name, body.code, body.generic_name || null,
      body.api_grade || null, body.batch_size || null, body.batch_size_unit || 'kg',
      body.shelf_life_months || null, body.license_no || null,
      body.standard_yield || null, body.therapeutic_category || null
    );

    // If parameters are provided, insert them
    if (body.parameters && Array.isArray(body.parameters)) {
      const paramStmt = db.prepare(`
        INSERT INTO product_parameters (id, product_id, name, type, unit, usl, lsl, target, stage, is_critical, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      body.parameters.forEach((p: any, i: number) => {
        paramStmt.run(
          uuid(), id, p.name, p.type || 'cqa', p.unit || null,
          p.usl ?? null, p.lsl ?? null, p.target ?? null,
          p.stage || null, p.is_critical ?? 1, i
        );
      });
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    db.save();
    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
