import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';

// Reads auth cookies and mints a fresh token per request — never prerender.
export const dynamic = 'force-dynamic';

// Mints a short-lived, single-use ephemeral token for the browser to open a
// Gemini Live session directly. The API key never leaves the server.
//
// Ephemeral tokens are Gemini Developer API only and supported in v1alpha only,
// so both this client and the browser's GoogleGenAI client must pin v1alpha.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
      httpOptions: { apiVersion: 'v1alpha' },
    });

    const now = Date.now();
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        // Token usable for 30 min; new sessions must start within 1 min.
        expireTime: new Date(now + 30 * 60_000).toISOString(),
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        httpOptions: { apiVersion: 'v1alpha' },
      },
    });

    return NextResponse.json({ token: token.name });
  } catch (err) {
    console.error('[/api/live-token]', err);
    return NextResponse.json({ error: 'Failed to create live token' }, { status: 500 });
  }
}
