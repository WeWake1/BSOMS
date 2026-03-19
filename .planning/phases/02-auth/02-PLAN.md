---
plan: 02
phase: 2
wave: 1
title: Login Page with Server Action
depends_on: []
files_modified:
  - app/(auth)/login/page.tsx
  - app/(auth)/login/actions.ts
  - app/(auth)/layout.tsx
  - components/ui/button.tsx
  - components/ui/input.tsx
autonomous: true
requirements_addressed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]
---

# Plan 02: Login Page with Server Action

## Objective

Build the `/login` page as a mobile-first, centered form with email + password inputs, an inline error display, and a loading state. Implement the Server Action for Supabase sign-in.

## Context

<read_first>
- .planning/phases/02-auth/02-CONTEXT.md
- lib/supabase/server.ts
- lib/supabase/client.ts
- app/globals.css
- tailwind.config.ts
</read_first>

## Tasks

### Task 2.1: Create Reusable UI Primitives

<action>
Create `components/ui/button.tsx`:

```typescript
import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

    const variants = {
      primary:
        'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 focus-visible:ring-indigo-500',
      secondary:
        'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-gray-400',
      ghost:
        'text-gray-600 hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-gray-400',
    };

    const sizes = {
      sm: 'h-9 px-4 text-sm gap-1.5',
      md: 'h-11 px-5 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2',
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>Signing in…</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
```

Create `components/ui/input.tsx`:

```typescript
import { type InputHTMLAttributes, forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  showPasswordToggle?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, showPasswordToggle, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputType = showPasswordToggle
      ? showPassword
        ? 'text'
        : 'password'
      : type;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={id}
          className="text-sm font-medium text-gray-700"
        >
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={inputType}
            className={cn(
              'w-full h-11 px-3.5 rounded-xl border bg-white text-gray-900 text-sm',
              'placeholder:text-gray-400',
              'transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
              error
                ? 'border-red-400 focus:ring-red-400'
                : 'border-gray-300',
              showPasswordToggle && 'pr-11',
              className
            )}
            {...props}
          />
          {showPasswordToggle && (
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 hover:text-gray-600 focus:outline-none"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
```
</action>

<acceptance_criteria>
- `components/ui/button.tsx` exports `Button` with `loading` prop showing spinner
- `components/ui/input.tsx` exports `Input` with `label`, `error`, `showPasswordToggle` props
- Both use `cn()` from `@/lib/utils`
</acceptance_criteria>

---

### Task 2.2: Create Server Action for Sign In

<action>
Create `app/(auth)/login/actions.ts`:

```typescript
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signIn(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return 'Please enter your email and password.';
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Return generic error — don't reveal which field is wrong
    return 'Invalid email or password. Please try again.';
  }

  redirect('/dashboard');
}
```
</action>

<acceptance_criteria>
- `app/(auth)/login/actions.ts` exists with `'use server'` directive
- `signIn` function takes `_prevState` and `formData` (for `useActionState` hook)
- Returns generic `'Invalid email or password'` string on auth error
- Calls `redirect('/dashboard')` on success
</acceptance_criteria>

---

### Task 2.3: Create Auth Layout

<action>
Create `app/(auth)/layout.tsx`:

```typescript
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
```
</action>

<acceptance_criteria>
- `app/(auth)/layout.tsx` exists
- Layout centers children vertically and horizontally
- Uses gradient background
</acceptance_criteria>

---

### Task 2.4: Create Login Page

<action>
Create `app/(auth)/login/page.tsx` as a client component with `useActionState`:

```typescript
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signIn } from './actions';

export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(signIn, null);

  return (
    <div className="w-full max-w-sm">
      {/* Brand */}
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

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/80 border border-gray-100 p-6">
        {/* Inline error */}
        {error && (
          <div
            id="login-error"
            role="alert"
            className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form action={formAction} className="flex flex-col gap-4">
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
            disabled={isPending}
          />

          <Input
            id="password"
            name="password"
            label="Password"
            placeholder="••••••••"
            autoComplete="current-password"
            showPasswordToggle
            required
            disabled={isPending}
          />

          <Button
            type="submit"
            className="w-full mt-1"
            size="lg"
            loading={isPending}
          >
            Sign in
          </Button>
        </form>
      </div>

      <p className="text-center text-xs text-gray-400 mt-6">
        Contact your admin if you need access.
      </p>
    </div>
  );
}
```
</action>

<acceptance_criteria>
- `app/(auth)/login/page.tsx` has `'use client'` directive
- Uses `useActionState(signIn, null)` hook
- Has `id="email"` and `id="password"` on inputs
- Has `id="login-error"` on error div with `role="alert"`
- Error div only rendered when `error` is truthy
- Button shows loading state when `isPending` is true
- Button is disabled during form submission
</acceptance_criteria>

## Verification

```bash
npx tsc --noEmit
# Should complete with 0 errors
```

## must_haves

- [ ] `/login` page renders with email + password fields
- [ ] Server action returns error string, not thrown exception
- [ ] Error shown inline below brand, not as browser alert
- [ ] Button disabled and shows spinner during submission
- [ ] All inputs have `id` attributes matching `htmlFor` labels
