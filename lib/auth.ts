import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/database';

export interface AuthUser {
  id: string;
  email: string | undefined;
  profile: Profile;
}

/**
 * Get the current authenticated user with their profile/role.
 * Returns null if not authenticated or profile not found.
 */
export async function getUser(): Promise<AuthUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const serviceClient = createServiceClient();

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Profile missing or error:', profileError);
    // User is auth'd but their profile row is missing or blocked by RLS.
    const errorMsg = profileError?.message || `No DB row found for ${user.id}`;
    redirect(`/unauthorized?error=${encodeURIComponent(errorMsg)}`);
  }

  return {
    id: user.id,
    email: user.email,
    profile: profile as Profile,
  };
}

/**
 * Require authentication. Redirects to /login if not authenticated.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Require admin role.
 * Redirects to /dashboard if authenticated but not admin.
 * Redirects to /login if not authenticated.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.profile.role !== 'admin') redirect('/dashboard');
  return user;
}

/**
 * Require admin OR staff role (anyone who can change order status).
 * Redirects to /dashboard if viewer; /login if not authenticated.
 */
export async function requireStaffOrAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.profile.role === 'viewer') redirect('/dashboard');
  return user;
}

/** Can this user change order status (admin or staff)? */
export function canChangeStatus(profile: Profile): boolean {
  return profile.role === 'admin' || profile.role === 'staff';
}

/** Can this user fully edit/delete orders (admin only)? */
export function canEditOrders(profile: Profile): boolean {
  return profile.role === 'admin';
}

/**
 * Redirect to /dashboard if already authenticated.
 * Use on the login page.
 */
export async function redirectIfAuthenticated(): Promise<void> {
  const user = await getUser();
  if (user) redirect('/dashboard');
}
