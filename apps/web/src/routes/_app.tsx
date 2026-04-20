import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import {
  BookOpen,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Sparkles,
  Tv2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { ErrorBoundary } from '../components/error-boundary';
import { Button } from '../components/ui/button';
import { authQueryOptions, logout } from '../lib/api';
import { useTheme } from '../hooks/use-theme';
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
  { to: '/tonight', label: 'Tonight', icon: Sparkles },
  { to: '/items', label: 'All items', icon: LayoutDashboard },
  { to: '/items', search: { type: 'game' }, label: 'Games', icon: Gamepad2 },
  { to: '/items', search: { type: 'anime' }, label: 'Anime', icon: Tv2 },
  { to: '/items', search: { type: 'book' }, label: 'Books', icon: BookOpen },
  { to: '/items', search: { type: 'gunpla' }, label: 'Gunpla', icon: Package },
] as const;

function SidebarContent({ onNavClick }: { onNavClick?: () => void }) {
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
    <>
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
            onClick={onNavClick}
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
          onClick={onNavClick}
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
    </>
  );
}

function AppLayout() {
  useTheme();

  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => { setMobileOpen(false); };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Mobile backdrop ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      {/*
        Mobile: fixed drawer, slides in/out with translate-x.
        Desktop (lg+): relative flex child, always visible.
      */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 ease-in-out',
          'lg:relative lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Mobile close button */}
        <button
          type="button"
          onClick={closeMobile}
          className="absolute right-3 top-3.5 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>

        <SidebarContent onNavClick={closeMobile} />
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
          <button
            type="button"
            onClick={() => { setMobileOpen(true); }}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display text-base font-bold tracking-tight text-foreground">
            hobby<span className="text-primary">·</span>track
          </span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
