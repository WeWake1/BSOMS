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
  mobile_no: string | null;
  category_id: string;
  date: string;
  due_date: string;
  dispatch_date: string | null;
  length: string | null;
  width: string | null;
  qty: number;
  description: string | null;
  photo_url: string | null;
  audio_url: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface OrderWithCategory extends Order {
  categories: Category | null;
}

// Alias kept for backward compatibility — same shape as OrderWithCategory
export type OrderWithCategoryAndItems = OrderWithCategory;

export type UserRole = 'admin' | 'viewer' | 'staff';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
}

export type OrderEventType = 'created' | 'status_changed' | 'deleted';

export interface OrderActivityLog {
  id: string;
  event_type: OrderEventType;
  order_id: string | null;
  order_no: string | null;
  customer_name: string | null;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  changed_by: string | null;
  changed_by_name: string | null;
  changed_by_role: string | null;
  changed_at: string;
}

// ─── Pricelist module ──────────────────────────────────────────────────
export type PricelistNodeKind = 'group' | 'product';

export interface PricelistSupplier {
  id: string;
  name: string;
  location: string | null;
  contact_name: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PricelistPrice {
  id: string;
  node_id: string;
  label: string;
  /** Admin sees the purchase rate here; staff/viewer rows (from the
   *  pricelist_prices_selling view) carry the computed selling rate. */
  rate: number;
  unit: string | null;
  sort_order: number;
  created_at: string;
  /** Selling margin % for this tier; null = use the global default.
   *  Always null on staff/viewer rows — the view never exposes it. */
  margin_pct: number | null;
}

/** Single-row table holding the global default selling margin (admin-only). */
export interface PricelistSettings {
  id: number;
  default_margin_pct: number;
  updated_at: string;
}

export interface PricelistNode {
  id: string;
  parent_id: string | null;
  kind: PricelistNodeKind;
  name: string;
  length: number | null;
  width: number | null;
  thickness: number | null;
  unit: string | null;
  tags: string[];
  supplier_id: string | null;
  /** Optional external link (e.g. Google Drive catalogue / designs). */
  catalogue_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** A node with its joined prices + supplier (shape returned by the queries). */
export interface PricelistNodeWithRelations extends PricelistNode {
  prices: PricelistPrice[];
  supplier: PricelistSupplier | null;
}

/** A node with its children attached — the tree shape built client-side. */
export interface PricelistTreeNode extends PricelistNodeWithRelations {
  children: PricelistTreeNode[];
  depth: number;
}

export type Database = {
  public: {
    Tables: {
      pricelist_suppliers: {
        Row: PricelistSupplier;
        Insert: Omit<PricelistSupplier, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<PricelistSupplier, 'id' | 'created_at'>>;
      };
      pricelist_nodes: {
        Row: PricelistNode;
        Insert: Omit<PricelistNode, 'id' | 'created_at' | 'updated_at' | 'tags'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          tags?: string[];
        };
        Update: Partial<Omit<PricelistNode, 'id' | 'created_at'>>;
      };
      pricelist_prices: {
        Row: PricelistPrice;
        Insert: Omit<PricelistPrice, 'id' | 'created_at' | 'margin_pct'> & {
          id?: string;
          created_at?: string;
          margin_pct?: number | null;
        };
        Update: Partial<Omit<PricelistPrice, 'id' | 'created_at'>>;
      };
      pricelist_settings: {
        Row: PricelistSettings;
        Insert: Partial<PricelistSettings>;
        Update: Partial<Omit<PricelistSettings, 'id'>>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Order, 'id' | 'created_at'>>;
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
      order_activity_logs: {
        Row: OrderActivityLog;
        Insert: Omit<OrderActivityLog, 'id' | 'changed_at'> & {
          id?: string;
          changed_at?: string;
        };
        Update: Partial<Omit<OrderActivityLog, 'id'>>;
      };
    };
    Enums: {
      order_status: OrderStatus;
      order_event_type: OrderEventType;
      pricelist_node_kind: PricelistNodeKind;
    };
  };
};
