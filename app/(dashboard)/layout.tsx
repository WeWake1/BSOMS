import { requireAuth } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check — redirects to /login if not authenticated
  await requireAuth();

  return (
    <div className="min-h-dvh bg-gray-50">
      {children}
    </div>
  );
}
