import type { Unit } from './lib/units.js';

export type Role = 'owner' | 'manager' | 'employee';
export type StockStatus = 'ok' | 'low' | 'out' | 'none';

export interface Profile {
  id: string;
  restaurant_id: string;
  full_name: string;
  role: Role;
  active: boolean;
  nick?: string | null;
}

export interface WorkShift {
  id: string;
  profile_id: string;
  started_at: string;
  ended_at: string | null;
  note: string | null;
  source: 'clock' | 'manual';
}

export interface StockMove {
  id: string;
  product_id: string;
  type: string;
  quantity_delta: number | string;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface Restaurant {
  id: string;
  name: string;
  timezone: string;
  summary_time: string;
  summary_emails: string[];
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  unit: Unit;
  minimum_stock: number | string;
  active: boolean;
  category_id: string | null;
  icon?: string | null;
}

export interface ProductStock {
  product_id: string;
  name: string;
  unit: Unit;
  category_id: string | null;
  minimum_stock: number | string;
  active: boolean;
  stock: number | string;
  status: StockStatus;
  icon?: string | null;
}

export interface Shortage {
  id: string;
  product_id: string;
  quantity: number | string;
  unit: Unit;
  urgent: boolean;
  note: string | null;
  status: 'open' | 'resolved' | 'cancelled';
  reported_by: string;
  created_at: string;
}

export interface ShoppingItem {
  product_id: string;
  product_name: string;
  category_name: string;
  category_order: number | null;
  unit: Unit;
  total_quantity: number | string;
  urgent: boolean;
  reports_count: number;
  first_reported_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: 'todo' | 'done';
  assigned_to: string | null;
  done_by: string | null;
  done_at: string | null;
  template_id: string | null;
  created_at: string;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  days_of_week: number[];
  active: boolean;
}

export interface Movement {
  id: string;
  product_id: string;
  type: 'purchase' | 'consumption' | 'waste' | 'adjustment' | 'count_correction';
  quantity_delta: number | string;
  note: string | null;
  created_by: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  active: boolean;
}

export interface PurchaseOverview {
  id: string;
  purchase_date: string;
  document_number: string | null;
  status: 'draft' | 'confirmed' | 'cancelled';
  supplier_id: string | null;
  supplier_name: string | null;
  items_count: number;
  total_net: number | string;
  total_gross: number | string;
}

export interface PurchaseItem {
  id: string;
  product_id: string;
  quantity: number | string;
  unit_price_net: number | string;
  vat_rate: number | string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardSummary {
  today: string;
  low_stock: number;
  out_of_stock: number;
  shopping_items: number;
  urgent_items: number;
  tasks_total: number;
  tasks_done: number;
  unread_notifications: number;
  purchases_today_gross: number | string | null;
}

export interface TeamUser {
  id: string;
  email: string | null;
  nick: string | null;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}
