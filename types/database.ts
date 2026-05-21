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
    };
  };
};
