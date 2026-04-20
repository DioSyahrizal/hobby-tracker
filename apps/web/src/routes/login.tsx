import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { HttpError, authQueryOptions, login } from '../lib/api';

const loginSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof loginSchema>;

export const Route = createFileRoute('/login')({
  // Already logged in → skip the login page entirely
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient
      .fetchQuery(authQueryOptions)
      .catch(() => ({ authenticated: false }));
    if (auth.authenticated) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: '/items' });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const loginMutation = useMutation({
    mutationFn: ({ password }: LoginForm) => login(password),
    onSuccess: async () => {
      await qc.invalidateQueries(authQueryOptions);
      await navigate({ to: '/items' });
    },
    onError: (err) => {
      const message =
        err instanceof HttpError && err.status === 401
          ? 'Wrong password.'
          : 'Something went wrong. Try again.';
      setError('password', { message });
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand mark */}
        <div className="text-center">
          <span className="font-display text-3xl font-bold tracking-tight text-foreground">
            hobby<span className="text-primary">·</span>track
          </span>
          <p className="mt-1 text-sm text-muted-foreground">Your personal backlog, your rules.</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Enter your password to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
            <form onSubmit={handleSubmit((d) => { loginMutation.mutate(d); })} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  autoFocus
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
