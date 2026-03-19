import { signOut } from '@/app/(auth)/login/actions';
import { Button } from '@/components/ui/button';

export default function UnauthorizedPage() {
  return (
    <div className="w-full max-w-md text-center">
      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/80 border border-gray-100 p-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-6 mx-auto">
          <svg className="w-8 h-8 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
          Profile Access Error
        </h1>
        <p className="text-sm font-medium text-gray-500 mb-6">
          You are signed in, but your user account is missing a corresponding row in the <strong>profiles</strong> table.
        </p>
        
        <div className="bg-gray-50 rounded-xl p-4 text-left text-sm text-gray-700 mb-8 border border-gray-100">
          <p className="font-semibold mb-2">How to fix this as Admin:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Go to your Supabase Dashboard</li>
            <li>Go to <strong>Authentication</strong> and copy your User UID</li>
            <li>Go to <strong>Table Editor</strong> → <strong>profiles</strong> table</li>
            <li>Insert a new row with your UID as the <strong>id</strong></li>
            <li>Set <strong>role</strong> to <strong>admin</strong></li>
          </ol>
        </div>

        <form action={signOut}>
          <Button type="submit" variant="secondary" className="w-full">
            Sign out and try again
          </Button>
        </form>
      </div>
    </div>
  );
}
