import { Type } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';

export const TEXT_MODEL = 'gemma-4-31b-it';

export const VOICE_MODEL = 'gemini-3.1-flash-live-preview';

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
