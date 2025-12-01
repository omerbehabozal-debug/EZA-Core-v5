/**
 * useStreamResponse Hook
 * Handles streaming responses from backend using ReadableStream + TextDecoder
 */

import { useState, useCallback, useRef } from 'react';

interface StreamResponse {
  text: string;
  done: boolean;
  assistantScore?: number;
  userScore?: number;
  error?: string;
}

interface UseStreamResponseReturn {
  streamText: string;
  isStreaming: boolean;
  error: string | null;
  startStream: (url: string, body: any, options?: { onToken?: (token: string) => void; onDone?: (data: any) => void }) => Promise<StreamResponse>;
  reset: () => void;
}

export function useStreamResponse(): UseStreamResponseReturn {
  const [streamText, setStreamText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (
    url: string,
    body: any,
    options?: { onToken?: (token: string) => void; onDone?: (data: any) => void }
  ): Promise<StreamResponse> => {
    // Reset state
    setStreamText('');
    setError(null);
    setIsStreaming(true);

    // Create new AbortController for this stream
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // For Next.js API routes, use relative path (client-side)
      // For direct backend calls, use full URL
      let fullUrl: string;
      if (typeof window !== 'undefined' && url.startsWith('/api/')) {
        // Client-side API route - use relative path
        fullUrl = url;
      } else {
        // Direct backend call or server-side
        const baseURL = process.env.NEXT_PUBLIC_EZA_API_URL || 'http://localhost:8000';
        fullUrl = `${baseURL}${url}`;
      }

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: abortController.signal,
      });

      if (!response.ok) {
        // Handle 404 specifically
        if (response.status === 404) {
          throw new Error('Backend endpoint bulunamadı. Backend çalışıyor mu ve /api/standalone/stream endpoint\'i mevcut mu kontrol edin.');
        }
        
        // Try to parse error response
        let errorData: any = {};
        try {
          const text = await response.text();
          if (text) {
            errorData = JSON.parse(text);
          }
        } catch {
          // If not JSON, use status text
          errorData = { detail: response.statusText };
        }
        
        throw new Error(
          errorData.error?.error_message || 
          errorData.detail || 
          errorData.message || 
          `Backend hatası: HTTP ${response.status}`
        );
      }

      // Check if response is streaming (text/event-stream or application/x-ndjson)
      const contentType = response.headers.get('content-type') || '';
      const isStreaming = contentType.includes('text/event-stream') || 
                         contentType.includes('application/x-ndjson') ||
                         contentType.includes('text/plain');

      if (!isStreaming) {
        // Fallback to regular JSON response
        const data = await response.json();
        setIsStreaming(false);
        return {
          text: data.data?.assistant_answer || data.data?.safe_answer || '',
          done: true,
          assistantScore: data.data?.assistant_score,
          userScore: data.data?.user_score,
        };
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      let finalData: any = null;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          // Handle SSE format: data: {...}
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6); // Remove "data: " prefix
            try {
              const data = JSON.parse(jsonStr);
              
              if (data.token) {
                // Token chunk
                accumulatedText += data.token;
                setStreamText(accumulatedText);
                options?.onToken?.(data.token);
              } else if (data.done) {
                // Stream complete
                finalData = data;
                break;
              }
            } catch (e) {
              // If not JSON, treat as plain text token
              const token = jsonStr.trim();
              if (token) {
                accumulatedText += token;
                setStreamText(accumulatedText);
                options?.onToken?.(token);
              }
            }
          } else {
            // Try to parse as JSON (NDJSON format)
            try {
              const data = JSON.parse(line);
              if (data.token) {
                accumulatedText += data.token;
                setStreamText(accumulatedText);
                options?.onToken?.(data.token);
              } else if (data.done) {
                finalData = data;
                break;
              }
            } catch {
              // Plain text token
              const token = line.trim();
              if (token) {
                accumulatedText += token;
                setStreamText(accumulatedText);
                options?.onToken?.(token);
              }
            }
          }
        }

        if (finalData) break;
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer);
          if (data.done) {
            finalData = data;
          }
        } catch {
          // Treat as plain text
          accumulatedText += buffer;
          setStreamText(accumulatedText);
        }
      }

      setIsStreaming(false);

      const result: StreamResponse = {
        text: accumulatedText,
        done: true,
        assistantScore: finalData?.assistant_score,
        userScore: finalData?.user_score,
      };

      options?.onDone?.(result);
      return result;

    } catch (err: any) {
      setIsStreaming(false);
      const errorMessage = err.message || 'Streaming failed';
      setError(errorMessage);
      
      if (err.name === 'AbortError') {
        return {
          text: streamText,
          done: false,
          error: 'Stream cancelled',
        };
      }

      return {
        text: streamText,
        done: false,
        error: errorMessage,
      };
    }
  }, [streamText]);

  const reset = useCallback(() => {
    // Abort current stream if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreamText('');
    setIsStreaming(false);
    setError(null);
  }, []);

  return {
    streamText,
    isStreaming,
    error,
    startStream,
    reset,
  };
}

