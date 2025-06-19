import { NextResponse } from 'next/server';
import { TokenStorage } from '@/lib/redis';

export async function POST() {
  try {
    await TokenStorage.clearToken();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Successfully disconnected from Freelancer' 
    });
  } catch (error) {
    console.error('Failed to disconnect:', error);
    
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect account' },
      { status: 500 }
    );
  }
}