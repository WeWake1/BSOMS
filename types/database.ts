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
  description: string | null;
  photo_url: string | null;
  audio_url: string | null;
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
