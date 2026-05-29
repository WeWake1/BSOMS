import { Type } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';
import * as queries from '@/lib/supabase/chatbot-queries';

export const TEXT_MODEL = 'gemma-4-31b-it';

// Live (audio-to-audio) model — Gemini 3.1 Flash Live, native audio-to-audio.
// If the API key lacks preview access, fall back to 'gemini-live-2.5-flash-preview'.
export const LIVE_MODEL = 'gemini-3.1-flash-live-preview';

export const SYSTEM_INSTRUCTION =
  'You are an order management assistant for OrderFlow. You have access to a live database of orders. ' +
  'Answer questions about orders clearly and concisely. Always use your database tools to fetch real-time data ' +
  'before answering — never guess or make up order data. Keep answers brief and mobile-friendly, ' +
  '2-4 sentences maximum unless the user asks for a full list. ' +
  'Respond in the same language the user speaks: if the user writes or speaks in Hindi, respond in Hindi; ' +
  'if in Gujarati, respond in Gujarati; if in English, respond in English. ' +
  'You may mix languages naturally if the user does (code-switching is fine).';

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_orders_summary',
    description: 'Get a count of orders grouped by status (Pending, In Progress, Packing, Dispatched)',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_orders_by_status',
    description: 'Get all orders matching a specific status',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
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
      type: Type.OBJECT,
      properties: {
        customer_name: {
          type: Type.STRING,
          description: 'Customer name to search for (partial match)',
        },
      },
      required: ['customer_name'],
    },
  },
  {
    name: 'get_orders_by_category',
    description: 'Get all orders in a given category (fuzzy category name match)',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category_name: {
          type: Type.STRING,
          description: 'Category name to filter by (partial match)',
        },
      },
      required: ['category_name'],
    },
  },
  {
    name: 'get_overdue_orders',
    description: 'Get orders that are past their due date and not yet dispatched',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_orders_due_soon',
    description: 'Get orders due within the next N days that are not yet dispatched',
    parameters: {
      type: Type.OBJECT,
      properties: {
        days: {
          type: Type.NUMBER,
          description: 'Number of days to look ahead',
        },
      },
      required: ['days'],
    },
  },
  {
    name: 'get_order_detail',
    description: 'Get full details of a single order by order number',
    parameters: {
      type: Type.OBJECT,
      properties: {
        order_no: {
          type: Type.STRING,
          description: 'The order number to look up',
        },
      },
      required: ['order_no'],
    },
  },
  {
    name: 'get_dispatch_summary',
    description: 'Get count and total quantity of dispatched orders within a date range',
    parameters: {
      type: Type.OBJECT,
      properties: {
        start_date: {
          type: Type.STRING,
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: Type.STRING,
          description: 'End date in YYYY-MM-DD format',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
];

// Executes a single tool call against the order database. Shared by the text
// chat route (server Supabase client) and the live voice hook (browser client);
// both run read-only through RLS, so either client works.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeTool(name: string, args: Record<string, unknown>, client: any): Promise<unknown> {
  switch (name) {
    case 'get_orders_summary':
      return queries.getOrdersSummary(client);
    case 'get_orders_by_status':
      return queries.getOrdersByStatus(client, args.status as string);
    case 'get_orders_by_customer':
      return queries.getOrdersByCustomer(client, args.customer_name as string);
    case 'get_orders_by_category':
      return queries.getOrdersByCategory(client, args.category_name as string);
    case 'get_overdue_orders':
      return queries.getOverdueOrders(client);
    case 'get_orders_due_soon':
      return queries.getOrdersDueSoon(client, args.days as number);
    case 'get_order_detail':
      return queries.getOrderDetail(client, args.order_no as string);
    case 'get_dispatch_summary':
      return queries.getDispatchSummary(client, args.start_date as string, args.end_date as string);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
