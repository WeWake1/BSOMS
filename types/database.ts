export type OrderStatus = 'Pending' | 'In Progress' | 'Packing' | 'Dispatched';

export interface Category {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_no: string;
  customer_name: string;
  category_id: string;
  date: string;
  due_date: string;
  dispatch_date: string | null;
  length: number | null;
  width: number | null;
  qty: number;
  description: string | null;
  photo_url: string | null;
  audio_url: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  item_label: string | null;
  date: string;
  due_date: string;
  dispatch_date: string | null;
  length: number | null;
  width: number | null;
  qty: number;
  status: OrderStatus;
  description: string | null;
  photo_url: string | null;
  audio_url: string | null;
  sort_order: number | null;
  created_at: string;
}

export interface OrderWithCategory extends Order {
  categories: Category | null;
}

export interface OrderWithCategoryAndItems extends OrderWithCategory {
  order_items: OrderItem[];
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: 'admin' | 'viewer';
}

export type Database = {
  public: {
    Tables: {
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Order, 'id' | 'created_at'>>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<OrderItem, 'id' | 'created_at'>>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Category, 'id' | 'created_at'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Profile;
        Update: Partial<Profile>;
      };
    };
    Enums: {
      order_status: OrderStatus;
    };
  };
};

/**
 * Client-side draft representation of a sub-order item (used in localStorage + form state).
 * NOT a database type — never sent to Supabase directly.
 */
export interface SubItemDraft {
  /** client-side UUID for React key — generated with crypto.randomUUID() */
  tempId: string;
  /** null for new items not yet saved; existing order_items.id for saved items */
  dbId: string | null;
  categoryId: string;     // FK to categories.id — shown as the card title
  date: string;           // ISO date string YYYY-MM-DD
  dueDate: string;
  dispatchDate: string;   // '' if not set
  length: string;         // numeric string, '' if empty
  width: string;
  qty: string;            // numeric string, default '1'
  status: OrderStatus;
  description: string;
  photoPath: string | null;   // Supabase Storage path
  audioPath: string | null;
}

/**
 * Full form draft persisted to localStorage.
 * Key: `orderflow_draft_new` or `orderflow_draft_{orderId}`
 */
export interface OrderFormDraft {
  version: 1;
  savedAt: string;         // ISO timestamp
  orderId: string | null;  // null for new orders
  orderNo: string;
  customerName: string;
  categoryId: string;
  date: string;
  dueDate: string;
  dispatchDate: string;
  length: string;
  width: string;
  qty: string;
  status: OrderStatus;
  description: string;
  photoPath: string | null;
  audioPath: string | null;
  subItems: SubItemDraft[];
}
