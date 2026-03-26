import { NextResponse } from 'next/server';
import { getDb, resetAndSeed } from '@/lib/db';

export async function POST() {
  try {
    resetAndSeed();
    return NextResponse.json({ success: true, message: 'Demo data loaded successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
