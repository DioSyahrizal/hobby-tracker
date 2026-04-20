import { useQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  useNavigate,
} from '@tanstack/react-router';
import type { Item, ItemSort, ItemStatus, ItemType } from '@hobby-track/shared';
import {
  BookOpen,
  Gamepad2,
  Package,
  PackageSearch,
  Plus,
  Search,
  Tv2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { AddItemDialog } from '../components/add-item-dialog';
import { ItemCard } from '../components/item-card';
import { ItemDetailSheet } from '../components/item-detail-sheet';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { itemsQueryOptions } from '../lib/api';

// ── Route search schema ───────────────────────────────────────────────────────

const itemsSearchSchema = z.object({
  type: z.enum(['game', 'anime', 'book', 'gunpla']).optional(),
  status: z.enum(['wishlist', 'active', 'paused', 'completed', 'dropped']).optional(),
  q: z.string().optional(),
  sort: z.enum(['recent', 'priority', 'title', 'last_touched']).optional(),
});

export const Route = createFileRoute('/_app/items/')({
  validateSearch: (search) => {
    const result = itemsSearchSchema.safeParse(search);
    return result.success ? result.data : {};
  },
  component: ItemsPage,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_TABS: Array<{
  type: ItemType | undefined;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { type: undefined, label: 'All', icon: ({ className }) => <PackageSearch className={className} /> },
  { type: 'game', label: 'Games', icon: Gamepad2 },
  { type: 'anime', label: 'Anime', icon: Tv2 },
  { type: 'book', label: 'Books', icon: BookOpen },
  { type: 'gunpla', label: 'Gunpla', icon: Package },
];

const STATUS_OPTIONS: Array<{ value: ItemStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
];

const SORT_OPTIONS: Array<{ value: ItemSort; label: string }> = [
  { value: 'recent', label: 'Recently added' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'A → Z' },
  { value: 'last_touched', label: 'Last activity' },
];

const TYPE_LABEL: Record<ItemType, string> = {
  game: 'Games',
  anime: 'Anime',
  book: 'Books',
  gunpla: 'Gunpla',
};

// ── Skeleton grid ─────────────────────────────────────────────────────────────

function ItemGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[2/3] w-full rounded-xl" />
          <Skeleton className="h-3.5 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({
  type,
  hasFilters,
  onAdd,
}: {
  type?: ItemType;
  hasFilters: boolean;
  onAdd: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Search className="mb-4 h-14 w-14 text-muted-foreground/25" />
        <h3 className="font-display text-lg font-semibold text-foreground">
          No matches
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your filters or search terms.
        </p>
      </div>
    );
  }

  const typeLabel = type ? TYPE_LABEL[type].toLowerCase() : 'items';
  const addLabel = type ?? 'item';

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <PackageSearch className="mb-4 h-14 w-14 text-muted-foreground/25" />
      <h3 className="font-display text-lg font-semibold text-foreground">
        No {typeLabel} yet
      </h3>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Start building your backlog — add your first {addLabel}.
      </p>
      <Button onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" />
        Add {addLabel}
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function ItemsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [addOpen, setAddOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Local state for search input so typing doesn't wait for router round-trip
  const [searchInput, setSearchInput] = useState(search.q ?? '');

  // Keep local input in sync when URL changes externally
  useEffect(() => {
    setSearchInput(search.q ?? '');
  }, [search.q]);

  // Debounce: push to URL 400ms after last keystroke
  useEffect(() => {
    const t = setTimeout(() => {
      void navigate({
        search: (prev) => ({ ...prev, q: searchInput || undefined }),
        replace: true,
      });
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useQuery(
    itemsQueryOptions({
      type: search.type,
      status: search.status,
      search: search.q,
      sort: search.sort ?? 'recent',
    }),
  );

  const hasFilters = !!(search.status ?? search.q);
  const selectClass =
    'h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer';

  return (
    <div className="flex h-full flex-col">
      {/* ── Header bar ── */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {search.type ? TYPE_LABEL[search.type] : 'All items'}
            </h1>
            {data && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {data.total} {data.total === 1 ? 'item' : 'items'}
              </p>
            )}
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add item
          </Button>
        </div>

        {/* Type tabs */}
        <div className="mt-4 flex gap-1">
          {TYPE_TABS.map(({ type, label, icon: Icon }) => {
            const active = search.type === type;
            return (
              <button
                key={label}
                type="button"
                onClick={() =>
                  void navigate({
                    search: (prev) => ({ ...prev, type, q: undefined, status: undefined }),
                    replace: true,
                  })
                }
                className={[
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filters bar ── */}
      <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <select
          value={search.status ?? ''}
          onChange={(e) =>
            void navigate({
              search: (prev) => ({
                ...prev,
                status: (e.target.value as ItemStatus) || undefined,
              }),
              replace: true,
            })
          }
          className={selectClass}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={search.sort ?? 'recent'}
          onChange={(e) =>
            void navigate({
              search: (prev) => ({ ...prev, sort: e.target.value as ItemSort }),
              replace: true,
            })
          }
          className={selectClass}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {isLoading ? (
          <ItemGridSkeleton />
        ) : data?.items.length === 0 ? (
          <EmptyState
            type={search.type}
            hasFilters={hasFilters}
            onAdd={() => setAddOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {data?.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Dialogs ── */}
      <AddItemDialog open={addOpen} onClose={() => setAddOpen(false)} />

      {selectedItem && (
        <ItemDetailSheet
          item={selectedItem}
          open
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
