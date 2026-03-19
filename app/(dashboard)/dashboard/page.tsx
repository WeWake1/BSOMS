import { requireAuth } from '@/lib/auth';

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className="flex items-center justify-center min-h-dvh">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to OrderFlow</h1>
        <p className="text-gray-500">
          Signed in as <strong>{user.email}</strong> ({user.profile.role})
        </p>
        <p className="text-sm text-gray-400 mt-2">Dashboard coming in Phase 3…</p>
      </div>
    </div>
  );
}
