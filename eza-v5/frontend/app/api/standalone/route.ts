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
    const backendUrl = process.env.EZA_BACKEND_URL || process.env.NEXT_PUBLIC_EZA_API_URL || 'http://localhost:8000';
    
    // Ensure no double slashes
    const backendEndpoint = `${backendUrl.replace(/\/$/, '')}/api/standalone/standalone_chat`;

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

    // Get response data
    const data = await backendResponse.json();

    // Return backend response with same status
    return NextResponse.json(data, { status: backendResponse.status });

  } catch (error: any) {
    console.error('Standalone API Route Error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: { 
          error_message: error.message || 'Internal server error',
          error_code: 'ROUTE_HANDLER_ERROR'
        } 
      },
      { status: 500 }
    );
  }
}

