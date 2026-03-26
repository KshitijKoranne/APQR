import { NextRequest, NextResponse } from 'next/server';
import { ensureDb } from '@/lib/db';
import { calculateCapability, calculateYieldStats, generateControlChartData, generateMRChartData } from '@/lib/stats';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = await ensureDb();
    const product: any = db.prepare('SELECT * FROM products WHERE id = ?').get(params.id);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const parameters: any[] = db.prepare(
      'SELECT * FROM product_parameters WHERE product_id = ? ORDER BY sort_order, name'
    ).all(params.id);

    const batches: any[] = db.prepare(
      'SELECT * FROM batches WHERE product_id = ? ORDER BY manufacturing_date ASC, batch_number'
    ).all(params.id);

    if (batches.length === 0) {
      return NextResponse.json({
        product,
        parameters: [],
        yieldStats: null,
        batchCount: 0,
        parameterStats: [],
      });
    }

    const batchIds = batches.map((b) => b.id);
    const batchNumbers = batches.map((b) => b.batch_number);

    // Calculate stats for each parameter
    const parameterStats = parameters.map((param) => {
      const results: any[] = db.prepare(`
        SELECT br.value, b.batch_number, b.manufacturing_date, b.id as batch_id
        FROM batch_results br
        JOIN batches b ON br.batch_id = b.id
        WHERE br.parameter_id = ? AND b.product_id = ?
        ORDER BY b.manufacturing_date ASC, b.batch_number
      `).all(param.id, params.id);

      if (results.length === 0) {
        return { parameter: param, capability: null, chartData: [], mrChartData: [] };
      }

      const values = results.map((r) => r.value);
      const batchNums = results.map((r) => r.batch_number);

      const specs = { usl: param.usl, lsl: param.lsl, target: param.target };
      const capability = calculateCapability(values, specs);
      const chartData = generateControlChartData(batchNums, values, capability, specs);
      const mrChartData = generateMRChartData(batchNums, values, capability);

      return {
        parameter: param,
        capability,
        chartData,
        mrChartData,
        values: results.map((r) => ({
          batchNumber: r.batch_number,
          value: r.value,
          date: r.manufacturing_date,
        })),
      };
    });

    // Calculate yield stats
    const yields = batches
      .filter((b) => b.yield_percentage != null)
      .map((b) => b.yield_percentage);
    const yieldStats = yields.length > 0
      ? calculateYieldStats(yields, product.standard_yield)
      : null;

    // Yield chart data
    const yieldChartData = batches
      .filter((b) => b.yield_percentage != null)
      .map((b) => ({
        batchNumber: b.batch_number,
        yield: b.yield_percentage,
        date: b.manufacturing_date,
        standardYield: product.standard_yield,
      }));

    // Batch summary
    const batchSummary = {
      total: batches.length,
      released: batches.filter((b) => b.status === 'released').length,
      rejected: batches.filter((b) => b.status === 'rejected').length,
      reprocessed: batches.filter((b) => b.status === 'reprocessed').length,
      under_process: batches.filter((b) => b.status === 'under_process').length,
    };

    // OOS count
    const oosCount = db.prepare(
      'SELECT COUNT(*) as count FROM oos_results WHERE batch_id IN (' + batchIds.map(() => '?').join(',') + ')'
    ).get(...batchIds) as any;

    // Deviations summary
    const deviationSummary = db.prepare(`
      SELECT type, COUNT(*) as count FROM deviations WHERE product_id = ? GROUP BY type
    `).all(params.id);

    return NextResponse.json({
      product,
      batchCount: batches.length,
      batchSummary,
      yieldStats,
      yieldChartData,
      parameterStats,
      oosCount: oosCount?.count || 0,
      deviationSummary,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
