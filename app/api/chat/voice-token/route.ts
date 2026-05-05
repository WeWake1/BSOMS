import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { VOICE_MODEL } from '@/lib/gemini-tools';

// authTokens.create is v1alpha only
const genai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  httpOptions: { apiVersion: 'v1alpha' },
});

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Lock only the model in the constraint so the client can supply the
    // full session config (tools, transcription, thinkingConfig, etc.) on
    // connect without those fields being rejected by the constraint.
    const authToken = await genai.authTokens.create({
      config: {
        uses: 1,
        liveConnectConstraints: {
          model: VOICE_MODEL,
        },
      },
    });

    if (!authToken.name) {
      return NextResponse.json({ error: 'No token returned from Gemini' }, { status: 502 });
    }

    return NextResponse.json({ token: authToken.name, model: VOICE_MODEL });
  } catch (err: any) {
    console.error('[voice-token]', err?.message ?? err);
    return NextResponse.json({ error: 'Failed to generate voice token' }, { status: 500 });
  }
}
