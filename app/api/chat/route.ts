import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import { SYSTEM_INSTRUCTION, TOOL_DECLARATIONS, TEXT_MODEL, executeTool } from '@/lib/gemini-tools';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json() as {
      message: string;
      history: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Translate display history (plain text) into Gemini content format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseContents: any[] = [
      ...body.history.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: body.message }] },
    ];

    const geminiConfig = {
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    };

    // Function calling loop — Gemini may call tools before returning a text answer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let contents: any[] = [...baseContents];
    let finalText = '';

    for (let round = 0; round < 5; round++) {
      const result = await genai.models.generateContent({
        model: TEXT_MODEL,
        contents,
        config: geminiConfig,
      });

      const functionCalls = result.functionCalls;

      if (!functionCalls?.length) {
        finalText = result.text ?? '';
        break;
      }

      // Append the model's function call turn
      contents.push({
        role: 'model',
        parts: functionCalls.map(fc => ({ functionCall: fc })),
      });

      // Execute all calls in parallel, build function response parts
      const responseParts = await Promise.all(
        functionCalls.map(async fc => {
          try {
            const output = await executeTool(fc.name ?? '', fc.args ?? {}, supabase);
            return {
              functionResponse: {
                id: fc.id,
                name: fc.name,
                response: { result: output } as Record<string, unknown>,
              },
            };
          } catch (err) {
            return {
              functionResponse: {
                id: fc.id,
                name: fc.name,
                response: { error: String(err) } as Record<string, unknown>,
              },
            };
          }
        })
      );

      contents.push({ role: 'user', parts: responseParts });
    }

    return NextResponse.json({
      response: finalText || "I couldn't retrieve that information. Please try again.",
    });
  } catch (err) {
    console.error('[/api/chat]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
