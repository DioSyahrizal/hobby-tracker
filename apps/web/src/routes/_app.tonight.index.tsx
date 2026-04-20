import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { Item, RecommendResult } from '@hobby-track/shared';
import {
  BookOpen,
  Gamepad2,
  Loader2,
  Package,
  Sparkles,
  Tv2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ItemDetailSheet } from '../components/item-detail-sheet';
import { Button } from '../components/ui/button';
import { HttpError, getRecommendations, updateItem } from '../lib/api';

export const Route = createFileRoute('/_app/tonight/')({
  component: TonightPage,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const TIME_OPTIONS = [
  { value: 'short', label: 'Short', sub: '< 30 min' },
  { value: 'medium', label: 'Medium', sub: '30 min – 1 hr' },
  { value: 'long', label: 'Long', sub: '1–2 hrs' },
  { value: 'very_long', label: 'All in', sub: '2 hrs+' },
] as const;

const ENERGY_OPTIONS = [
  { value: 'light', label: 'Low', sub: 'Chill mode' },
  { value: 'medium', label: 'Medium', sub: 'Can focus' },
  { value: 'heavy', label: 'High', sub: 'Bring it on' },
] as const;

const PRESET_MOODS = [
  'cozy', 'chill', 'intense', 'action',
  'story', 'hands-on', 'casual', 'epic',
];

const TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  game: Gamepad2,
  anime: Tv2,
  book: BookOpen,
  gunpla: Package,
};

const TYPE_LABEL: Record<string, string> = {
  game: 'Game',
  anime: 'Anime',
  book: 'Book',
  gunpla: 'Gunpla',
};

// Max theoretical score = 125
const MAX_SCORE = 125;

// ── Chip selector (time / energy) ─────────────────────────────────────────────

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string; sub: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => { onChange(o.value); }}
            className={[
              'flex flex-col items-center rounded-xl border px-5 py-3 text-center transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent',
            ].join(' ')}
          >
            <span className="text-sm font-semibold">{o.label}</span>
            <span className="text-xs text-muted-foreground mt-0.5">{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Mood tag toggles ──────────────────────────────────────────────────────────

function MoodPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const toggle = (tag: string) => {
    onChange(
      selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag],
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_MOODS.map((tag) => {
        const active = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => { toggle(tag); }}
            className={[
              'rounded-full border px-3 py-1 text-xs font-medium transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
            ].join(' ')}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────

function ResultCard({
  result,
  rank,
  onOpen,
}: {
  result: RecommendResult;
  rank: number;
  onOpen: (item: Item) => void;
}) {
  const { item, score, reasons } = result;
  const Icon = TYPE_ICON[item.type] ?? Gamepad2;
  const pct = Math.round((score / MAX_SCORE) * 100);

  return (
    <div className="flex gap-4 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sm">
      {/* Rank + cover */}
      <div className="flex shrink-0 flex-col items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {rank}
        </span>
        {item.coverUrl ? (
          <img
            src={item.coverUrl}
            alt={item.title}
            className="h-24 w-16 rounded-lg object-cover shadow"
          />
        ) : (
          <div className="flex h-24 w-16 items-center justify-center rounded-lg bg-muted">
            <Icon className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col justify-between min-w-0">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground leading-snug line-clamp-2">
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {TYPE_LABEL[item.type]} · Priority {item.priority}/5
              </p>
            </div>
          </div>

          {/* Score bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Match score</span>
              <span className="font-semibold text-foreground">{score}/{MAX_SCORE}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${String(pct)}%` }}
              />
            </div>
          </div>

          {/* Reasons */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {reasons.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 text-xs text-primary"
              >
                ✓ {r}
              </span>
            ))}
          </div>
        </div>

        {/* Action */}
        <div className="mt-3">
          <Button size="sm" onClick={() => { onOpen(item); }}>
            {item.status === 'active' ? 'Open' : 'Start tonight'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Empty state (no active items) ─────────────────────────────────────────────

function NoActiveItems() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/30" />
      <h3 className="font-display text-base font-semibold text-foreground">
        No active items
      </h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Head to your backlog and set a few items to <strong>Active</strong> — then come back here for a recommendation.
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function TonightPage() {
  const qc = useQueryClient();

  const [time, setTime] = useState<'short' | 'medium' | 'long' | 'very_long'>('medium');
  const [energy, setEnergy] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [moods, setMoods] = useState<string[]>([]);

  const [results, setResults] = useState<RecommendResult[] | null>(null);
  const [sheetItem, setSheetItem] = useState<Item | null>(null);

  // ── Recommendations ────────────────────────────────────────────────────────

  const recommendMutation = useMutation({
    mutationFn: () => getRecommendations({ time, energy, mood: moods }),
    onSuccess: (data) => { setResults(data.results); },
    onError: () => { toast.error('Could not get recommendations. Please try again.'); },
  });

  // ── Activate + open ────────────────────────────────────────────────────────

  const activateMutation = useMutation({
    mutationFn: (item: Item) =>
      item.status === 'active'
        ? Promise.resolve(item)
        : updateItem(item.id, { status: 'active' }),
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: ['items'] });
      setSheetItem(updated);
    },
    onError: (err, item) => {
      if (err instanceof HttpError && err.status === 409) {
        // Active limit hit — just open the sheet; user can change status there
        toast.warning('Active limit reached — open the item to adjust.');
        setSheetItem(item);
      } else {
        toast.error('Failed to activate item. Try again.');
      }
    },
  });

  const handleOpen = (item: Item) => {
    if (item.status !== 'active') {
      activateMutation.mutate(item);
    } else {
      setSheetItem(item);
    }
  };

  const isPending = recommendMutation.isPending;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* ── Hero ── */}
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            What&rsquo;s on tonight?
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell me your situation and I&rsquo;ll find your best match from your active backlog.
          </p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="space-y-6 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">How much time do you have?</p>
          <ChipGroup options={TIME_OPTIONS} value={time} onChange={setTime} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Energy level?</p>
          <ChipGroup options={ENERGY_OPTIONS} value={energy} onChange={setEnergy} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">
            Mood? <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
          <MoodPicker selected={moods} onChange={setMoods} />
        </div>

        <Button
          className="w-full"
          onClick={() => { recommendMutation.mutate(); }}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {isPending ? 'Finding matches…' : 'Find my matches'}
        </Button>
      </div>

      {/* ── Results ── */}
      {results !== null && (
        <div className="mt-8 space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {results.length === 0
              ? 'No results'
              : `Your top ${results.length === 1 ? 'match' : `${String(results.length)} matches`}`}
          </h2>

          {results.length === 0 ? (
            <NoActiveItems />
          ) : (
            <div className="space-y-3">
              {results.map((r, i) => (
                <ResultCard
                  key={r.item.id}
                  result={r}
                  rank={i + 1}
                  onOpen={handleOpen}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Detail sheet ── */}
      {sheetItem && (
        <ItemDetailSheet
          item={sheetItem}
          open
          onClose={() => { setSheetItem(null); }}
        />
      )}
    </div>
  );
}
