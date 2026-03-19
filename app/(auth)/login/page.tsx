'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signIn } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      id="login-submit"
      type="submit"
      className="w-full mt-1"
      size="lg"
      loading={pending}
    >
      Sign in
    </Button>
  );
}

export default function LoginPage() {
  const [error, formAction] = useFormState(signIn, null);

  return (
    <div className="w-full max-w-sm">
      {/* Brand header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-200">
          <svg
            className="w-8 h-8 text-white"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <line x1="9" y1="12" x2="15" y2="12" />
            <line x1="9" y1="16" x2="13" y2="16" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          OrderFlow
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Sign in to your account
        </p>
      </div>

      {/* Login card */}
      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/80 border border-gray-100 p-6">
        {/* Inline error message */}
        {error && (
          <div
            id="login-error"
            role="alert"
            aria-live="polite"
            className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <Input
            id="email"
            name="email"
            type="email"
            label="Email address"
            placeholder="you@example.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
          />

          <Input
            id="password"
            name="password"
            label="Password"
            placeholder="••••••••"
            autoComplete="current-password"
            showPasswordToggle
            required
          />

          <SubmitButton />
        </form>
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        Contact your admin if you need access.
      </p>
    </div>
  );
}
