'use strict';

const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');

const VOICE_MODEL = 'gemini-3.1-flash-live-preview';

const SYSTEM_INSTRUCTION =
  'You are an order management assistant for OrderFlow. You have access to a live database of orders. ' +
  'Answer questions about orders clearly and concisely. Always use your database tools to fetch real-time data ' +
  'before answering — never guess or make up order data. Keep answers brief and mobile-friendly, ' +
  '2-4 sentences maximum unless the user asks for a full list. ' +
  'Respond in the same language the user speaks: if the user writes or speaks in Hindi, respond in Hindi; ' +
  'if in Gujarati, respond in Gujarati; if in English, respond in English. ' +
  'You may mix languages naturally if the user does (code-switching is fine).';

const TOOL_DECLARATIONS = [
  {
    name: 'get_orders_summary',
    description: 'Get a count of orders grouped by status (Pending, In Progress, Packing, Dispatched)',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_orders_by_status',
    description: 'Get all orders matching a specific status',
    parameters: {
      type: 'OBJECT',
      properties: {
        status: {
          type: 'STRING',
          enum: ['Pending', 'In Progress', 'Packing', 'Dispatched'],
          description: 'The order status to filter by',
        },
      },
      required: ['status'],
    },
  },
  {
    name: 'get_orders_by_customer',
    description: 'Get all orders for a customer (fuzzy name match)',
    parameters: {
      type: 'OBJECT',
      properties: {
        customer_name: { type: 'STRING', description: 'Customer name to search for (partial match)' },
      },
      required: ['customer_name'],
    },
  },
  {
    name: 'get_orders_by_category',
    description: 'Get all orders in a given category (fuzzy category name match)',
    parameters: {
      type: 'OBJECT',
      properties: {
        category_name: { type: 'STRING', description: 'Category name to filter by (partial match)' },
      },
      required: ['category_name'],
    },
  },
  {
    name: 'get_overdue_orders',
    description: 'Get orders that are past their due date and not yet dispatched',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_orders_due_soon',
    description: 'Get orders due within the next N days that are not yet dispatched',
    parameters: {
      type: 'OBJECT',
      properties: {
        days: { type: 'NUMBER', description: 'Number of days to look ahead' },
      },
      required: ['days'],
    },
  },
  {
    name: 'get_order_detail',
    description: 'Get full details of a single order by order number',
    parameters: {
      type: 'OBJECT',
      properties: {
        order_no: { type: 'STRING', description: 'The order number to look up' },
      },
      required: ['order_no'],
    },
  },
  {
    name: 'get_dispatch_summary',
    description: 'Get count and total quantity of dispatched orders within a date range',
    parameters: {
      type: 'OBJECT',
      properties: {
        start_date: { type: 'STRING', description: 'Start date in YYYY-MM-DD format' },
        end_date: { type: 'STRING', description: 'End date in YYYY-MM-DD format' },
      },
      required: ['start_date', 'end_date'],
    },
  },
];

function makeSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function executeTool(name, args) {
  const db = makeSupabaseClient();

  switch (name) {
    case 'get_orders_summary': {
      const { data, error } = await db.from('orders').select('status');
      if (error) throw new Error(error.message);
      const totals = { Pending: 0, 'In Progress': 0, Packing: 0, Dispatched: 0 };
      for (const o of data) totals[o.status] = (totals[o.status] ?? 0) + 1;
      return totals;
    }
    case 'get_orders_by_status': {
      const { data, error } = await db
        .from('orders')
        .select('order_no, customer_name, status, due_date, qty, categories(name)')
        .eq('status', args.status)
        .order('due_date', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_orders_by_customer': {
      const { data, error } = await db
        .from('orders')
        .select('order_no, customer_name, status, due_date, qty, categories(name)')
        .ilike('customer_name', `%${args.customer_name}%`)
        .order('due_date', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_orders_by_category': {
      const { data: cats, error: catErr } = await db
        .from('categories')
        .select('id')
        .ilike('name', `%${args.category_name}%`);
      if (catErr) throw new Error(catErr.message);
      if (!cats?.length) return [];
      const { data, error } = await db
        .from('orders')
        .select('order_no, customer_name, status, due_date, qty, categories(name)')
        .in('category_id', cats.map((c) => c.id))
        .order('due_date', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_overdue_orders': {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await db
        .from('orders')
        .select('order_no, customer_name, status, due_date, qty, categories(name)')
        .lt('due_date', today)
        .neq('status', 'Dispatched')
        .order('due_date', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_orders_due_soon': {
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + (args.days || 7));
      const { data, error } = await db
        .from('orders')
        .select('order_no, customer_name, status, due_date, qty, categories(name)')
        .gte('due_date', today.toISOString().split('T')[0])
        .lte('due_date', future.toISOString().split('T')[0])
        .neq('status', 'Dispatched')
        .order('due_date', { ascending: true });
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_order_detail': {
      const { data, error } = await db
        .from('orders')
        .select('*, categories(name)')
        .eq('order_no', args.order_no)
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    case 'get_dispatch_summary': {
      const { data, error } = await db
        .from('orders')
        .select('id, qty, dispatch_date')
        .eq('status', 'Dispatched')
        .gte('dispatch_date', args.start_date)
        .lte('dispatch_date', args.end_date);
      if (error) throw new Error(error.message);
      return {
        count: data.length,
        total_qty: data.reduce((s, o) => s + (o.qty || 0), 0),
        start_date: args.start_date,
        end_date: args.end_date,
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function safeSend(ws, data) {
  if (ws.readyState === 1 /* OPEN */) {
    try { ws.send(data); } catch (e) { /* browser may have disconnected */ }
  }
}

function safeSendBinary(ws, buffer) {
  if (ws.readyState === 1 /* OPEN */) {
    try { ws.send(buffer, { binary: true }); } catch (e) { /* browser may have disconnected */ }
  }
}

async function handleVoiceConnection(ws) {
  const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let session = null;
  let closed = false;

  function cleanup() {
    if (closed) return;
    closed = true;
    try { session?.close?.(); } catch {}
    session = null;
  }

  try {
    console.log('[voice-bridge] connecting to Gemini Live…');

    session = await genai.live.connect({
      model: VOICE_MODEL,
      config: {
        responseModalities: ['AUDIO'],
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          console.log('[voice-bridge] Gemini session open');
          safeSend(ws, JSON.stringify({ type: 'ready' }));
        },

        onmessage: async (msg) => {
          const sc = msg.serverContent;

          // Forward audio parts as raw binary to the browser
          const parts = sc?.modelTurn?.parts;
          if (parts) {
            for (const part of parts) {
              if (part.inlineData?.data) {
                const binary = Buffer.from(part.inlineData.data, 'base64');
                safeSendBinary(ws, binary);
              }
            }
          }

          // Forward input transcript (user speech)
          const inTx = sc?.inputTranscription?.text;
          if (inTx) safeSend(ws, JSON.stringify({ type: 'transcript', role: 'user', text: inTx }));

          // Forward output transcript (assistant speech)
          const outTx = sc?.outputTranscription?.text;
          if (outTx) safeSend(ws, JSON.stringify({ type: 'transcript', role: 'model', text: outTx }));

          if (sc?.turnComplete) safeSend(ws, JSON.stringify({ type: 'turn_complete' }));

          // Execute tool calls server-side with service role Supabase
          const fcs = msg.toolCall?.functionCalls;
          if (fcs?.length && session) {
            const responses = await Promise.all(
              fcs.map(async (fc) => {
                try {
                  console.log('[voice-bridge] tool call:', fc.name, fc.args);
                  const result = await executeTool(fc.name, fc.args ?? {});
                  return { id: fc.id, name: fc.name, response: { result } };
                } catch (err) {
                  console.error('[voice-bridge] tool error:', fc.name, err.message);
                  return { id: fc.id, name: fc.name, response: { error: String(err) } };
                }
              })
            );
            try { session.sendToolResponse({ functionResponses: responses }); } catch {}
          }
        },

        onerror: (err) => {
          console.error('[voice-bridge] Gemini error:', err);
          safeSend(ws, JSON.stringify({ type: 'error', message: err?.message || 'Gemini connection error' }));
          cleanup();
          if (ws.readyState === 1) ws.close(1011, 'Gemini error');
        },

        onclose: (ev) => {
          console.log('[voice-bridge] Gemini closed: code=', ev?.code, 'reason=', ev?.reason);
          cleanup();
          if (ws.readyState === 1) ws.close(1000, 'Session ended');
        },
      },
    });

    // ── Browser → Gemini ────────────────────────────────────────────────────
    ws.on('message', (data, isBinary) => {
      if (closed || !session) return;
      if (isBinary) {
        // Raw 16 kHz Int16 PCM from the browser's ScriptProcessorNode
        const b64 = Buffer.from(data).toString('base64');
        try {
          session.sendRealtimeInput({
            audio: { data: b64, mimeType: 'audio/pcm;rate=16000' },
          });
        } catch (e) {
          console.error('[voice-bridge] sendRealtimeInput error:', e?.message);
        }
      } else {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'stop') {
            try { session.sendRealtimeInput({ audioStreamEnd: true }); } catch {}
          }
        } catch {}
      }
    });

    ws.on('close', () => {
      console.log('[voice-bridge] browser disconnected');
      cleanup();
    });

    ws.on('error', (err) => {
      console.error('[voice-bridge] browser ws error:', err?.message);
      cleanup();
    });

  } catch (err) {
    console.error('[voice-bridge] connect error:', err?.message ?? err);
    safeSend(ws, JSON.stringify({ type: 'error', message: err?.message || 'Failed to start voice session' }));
    ws.close(1011, 'Failed to connect to Gemini');
  }
}

module.exports = { handleVoiceConnection };
