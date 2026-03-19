import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Profile missing or error:', profileError);
    // User is auth'd but their profile row is missing. 
    // Redirect to a specific error page instead of /login to avoid loops with middleware.
    redirect('/unauthorized');
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
 * Redirect to /dashboard if already authenticated.
 * Use on the login page.
 */
export async function redirectIfAuthenticated(): Promise<void> {
  const user = await getUser();
  if (user) redirect('/dashboard');
}
