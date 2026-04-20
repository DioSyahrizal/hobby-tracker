import type { Item } from '@hobby-track/shared';
import { BookOpen, Gamepad2, Package, Tv2 } from 'lucide-react';
import { Badge } from './ui/badge';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_ICONS = {
  game: Gamepad2,
  anime: Tv2,
  book: BookOpen,
  gunpla: Package,
} as const;

const STATUS_VARIANT = {
  wishlist: 'secondary',
  active: 'success',
  paused: 'warning',
  completed: 'default',
  dropped: 'destructive',
} as const;

const STATUS_LABEL = {
  wishlist: 'Wishlist',
  active: 'Active',
  paused: 'Paused',
  completed: 'Done',
  dropped: 'Dropped',
} as const;

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${String(days)}d ago`;
  if (days < 30) return `${String(Math.floor(days / 7))}w ago`;
  if (days < 365) return `${String(Math.floor(days / 30))}mo ago`;
  return `${String(Math.floor(days / 365))}y ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ItemCardProps {
  item: Item;
  onClick: () => void;
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  const Icon = TYPE_ICONS[item.type];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
    >
      <div className="bg-card border border-border rounded-xl overflow-hidden transition-all duration-200 group-hover:shadow-md group-hover:-translate-y-0.5">
        {/* ── Cover ── */}
        <div className="relative aspect-[2/3] bg-muted overflow-hidden">
          {item.coverUrl ? (
            <img
              src={item.coverUrl}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}

          {/* Status badge — top-left overlay */}
          <div className="absolute left-2 top-2">
            <Badge variant={STATUS_VARIANT[item.status]}>
              {STATUS_LABEL[item.status]}
            </Badge>
          </div>

          {/* Priority indicator — top-right overlay (only for priority 4-5) */}
          {item.priority >= 4 && (
            <div className="absolute right-2 top-2 rounded-full bg-black/60 px-1.5 py-0.5 text-xs font-bold text-amber-400">
              {'★'.repeat(item.priority - 3)}
            </div>
          )}
        </div>

        {/* ── Info footer ── */}
        <div className="p-3 space-y-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {item.title}
          </p>

          {item.currentProgress && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {item.currentProgress}
            </p>
          )}

          {item.lastTouchedAt && (
            <p className="text-xs text-muted-foreground/70">
              {relativeDate(item.lastTouchedAt)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
