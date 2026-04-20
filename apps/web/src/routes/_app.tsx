import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import {
  BookOpen,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Tv2,
} from 'lucide-react';
import { authQueryOptions, logout } from '../lib/api';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

export const Route = createFileRoute('/_app')({
  // Auth guard: fetch me, redirect to /login if unauthenticated.
  // fetchQuery throws on network error, which we also treat as unauthed.
  beforeLoad: async ({ context }) => {
    const auth = await context.queryClient
      .fetchQuery(authQueryOptions)
      .catch(() => ({ authenticated: false }));
    if (!auth.authenticated) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: '/login' });
    }
  },
  component: AppLayout,
});

const NAV = [
  { to: '/items', label: 'All items', icon: LayoutDashboard },
  { to: '/items', search: { type: 'game' }, label: 'Games', icon: Gamepad2 },
  { to: '/items', search: { type: 'anime' }, label: 'Anime', icon: Tv2 },
  { to: '/items', search: { type: 'book' }, label: 'Books', icon: BookOpen },
  { to: '/items', search: { type: 'gunpla' }, label: 'Gunpla', icon: Package },
] as const;

function AppLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      qc.clear();
      void navigate({ to: '/login' });
    },
  });

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        {/* Logo */}
        <div className="px-4 py-5">
          <span className="font-display text-lg font-bold tracking-tight text-foreground">
            hobby
            <span className="text-primary">·</span>
            track
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-2">
          {NAV.map(({ to, label, icon: Icon, ...rest }) => (
            <Link
              key={label}
              to={to}
              search={'search' in rest ? rest.search : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'text-muted-foreground hover:bg-accent hover:text-foreground',
                '[&.active]:bg-accent [&.active]:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="space-y-0.5 border-t border-sidebar-border px-2 py-3">
          <Link
            to="/settings"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
          >
            <Settings className="h-4 w-4 shrink-0" />
            Settings
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-3 font-medium text-muted-foreground"
            onClick={() => {
              logoutMutation.mutate();
            }}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {logoutMutation.isPending ? 'Logging out…' : 'Log out'}
          </Button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
