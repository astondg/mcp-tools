import { NextResponse } from 'next/server';
import { TokenStorage } from '@/lib/redis';

export async function GET() {
  try {
    const isAuthenticated = await TokenStorage.isAuthenticated();

    return NextResponse.json({
      authenticated: isAuthenticated
    });
  } catch (error) {
    console.error('Failed to check auth status:', error);

    return NextResponse.json(
      { authenticated: false, error: 'Failed to check authentication status' },
      { status: 500 }
    );
  }
}
