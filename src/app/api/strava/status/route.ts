import { NextResponse } from 'next/server';
import { getStoredTokens } from '@/lib/strava';

export async function GET() {
  try {
    const tokens = await getStoredTokens();
    if (!tokens) {
      return NextResponse.json({ authenticated: false });
    }
    return NextResponse.json({
      authenticated: true,
      athlete_id: tokens.athlete_id,
      athlete_username: tokens.athlete_username,
      expires_at: tokens.expires_at,
    });
  } catch (error) {
    console.error('Failed to check Strava status:', error);
    return NextResponse.json({ authenticated: false, error: 'Failed to check status' }, { status: 500 });
  }
}
