/**
 * Next.js API Route Handler for Standalone Streaming
 * Frontend → Next.js Route → Backend FastAPI (Streaming)
 */

import { NextRequest } from 'next/server';
import { getApiUrl } from '@/lib/apiUrl';

export async function POST(req: NextRequest) {
  try {
    const { query, safe_only } = await req.json();

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: { error_message: 'query parameter is required' } }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get backend URL from environment (required, no fallback)
    const backendUrl = getApiUrl();
    
    // Ensure no double slashes
    const backendEndpoint = `${backendUrl.replace(/\/$/, '')}/api/standalone/stream`;

    // Forward streaming request to backend
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
      const errorData = await backendResponse.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: errorData.error || { error_message: `Backend error: ${backendResponse.status}` }
        }),
        { 
          status: backendResponse.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Return streaming response with proper headers
    return new Response(backendResponse.body, {
      status: backendResponse.status,
      headers: {
        'Content-Type': backendResponse.headers.get('content-type') || 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Standalone Streaming API Route Error:', error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: { 
          error_message: error.message || 'Internal server error',
          error_code: 'ROUTE_HANDLER_ERROR'
        } 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

