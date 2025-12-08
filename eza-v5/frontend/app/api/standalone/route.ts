/**
 * Next.js API Route Handler for Standalone
 * Frontend → Next.js Route → Backend FastAPI
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { query, safe_only } = await req.json();

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: { error_message: 'query parameter is required' } },
        { status: 400 }
      );
    }

    // Get backend URL from environment
    const backendUrl = process.env.NEXT_PUBLIC_EZA_API_URL || 'https://eza-core-v5-production.up.railway.app';
    
    // Ensure no double slashes
    const backendEndpoint = `${backendUrl.replace(/\/$/, '')}/api/standalone`;

    // Forward request to backend
    const backendResponse = await fetch(backendEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: query.trim(),
        safe_only: safe_only || false 
      }),
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error_message: `Backend error: ${backendResponse.status} ${backendResponse.statusText}` };
      }
      return NextResponse.json(
        { 
          ok: false, 
          error: errorData.error || { error_message: errorData.error_message || `Backend returned ${backendResponse.status}` }
        },
        { status: backendResponse.status }
      );
    }

    // Get response data
    const data = await backendResponse.json();

    // Return backend response with same status
    return NextResponse.json(data, { status: backendResponse.status });

  } catch (error: any) {
    console.error('Standalone API Route Error:', error);
    
    // More specific error messages
    let errorMessage = 'Internal server error';
    if (error.message?.includes('fetch')) {
      errorMessage = 'Backend bağlantı hatası. Backend çalışıyor mu kontrol edin.';
    } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      errorMessage = 'Backend sunucusuna erişilemiyor. Lütfen daha sonra tekrar deneyin.';
    } else {
      errorMessage = error.message || 'Internal server error';
    }
    
    return NextResponse.json(
      { 
        ok: false, 
        error: { 
          error_message: errorMessage,
          error_code: 'ROUTE_HANDLER_ERROR'
        } 
      },
      { status: 500 }
    );
  }
}

