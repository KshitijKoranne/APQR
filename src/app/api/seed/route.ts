import { NextResponse } from 'next/server';
import { ensureDb, resetAndSeed } from '@/lib/db';

export async function POST() {
  try {
    await ensureDb();
    resetAndSeed();
    return NextResponse.json({ success: true, message: 'Demo data loaded successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
