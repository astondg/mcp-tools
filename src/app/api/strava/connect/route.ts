import { NextResponse } from 'next/server';
import { buildAuthorizeUrl } from '@/lib/strava';

export async function GET() {
  try {
    const url = buildAuthorizeUrl();
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new NextResponse(`Strava connect error: ${message}`, { status: 500 });
  }
}
