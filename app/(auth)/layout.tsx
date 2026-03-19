export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-indigo-50 via-white to-blue-50 flex items-center justify-center p-4">
      {children}
    </div>
  );
}
