import { NextRequest, NextResponse } from 'next/server';
import { TokenStorage } from '@/lib/redis';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  
  // Handle OAuth error
  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(new URL('/auth?error=oauth_error', request.url));
  }
  
  // Handle missing authorization code
  if (!code) {
    console.error('No authorization code received');
    return NextResponse.redirect(new URL('/auth?error=no_code', request.url));
  }
  
  try {
    // TODO: Exchange authorization code for access token
    // This requires registering the app with Freelancer first
    const tokenData = await exchangeCodeForToken(code);
    
    // Store the access token
    await TokenStorage.setFreelancerToken(tokenData.access_token);
    
    // Redirect to success page
    return NextResponse.redirect(new URL('/auth?success=true', request.url));
    
  } catch (error) {
    console.error('Token exchange failed:', error);
    return NextResponse.redirect(new URL('/auth?error=token_exchange', request.url));
  }
}

// TODO: Implement actual token exchange with Freelancer API
async function exchangeCodeForToken(code: string) {
  // This is a placeholder - will implement once we have Freelancer app credentials
  
  const tokenEndpoint = 'https://accounts.freelancer.com/oauth/token';
  const clientId = process.env.FREELANCER_CLIENT_ID;
  const clientSecret = process.env.FREELANCER_CLIENT_SECRET;
  const redirectUri = process.env.FREELANCER_REDIRECT_URI;
  
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Freelancer OAuth credentials in environment variables');
  }
  
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }
  
  const tokenData = await response.json();
  
  if (!tokenData.access_token) {
    throw new Error('No access token received from Freelancer');
  }
  
  return tokenData;
}