import { NextResponse } from 'next/server';
import { clearStoredTokens } from '@/lib/strava';

export async function POST() {
  try {
    await clearStoredTokens();
    return NextResponse.json({ success: true, message: 'Disconnected from Strava' });
  } catch (error) {
    console.error('Failed to disconnect from Strava:', error);
    return NextResponse.json({ success: false, error: 'Failed to disconnect' }, { status: 500 });
  }
}
