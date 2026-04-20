/**
 * Multi-step dialog for adding a new item to the backlog.
 *
 * Step 1 — Type picker (Game / Anime / Book / Gunpla)
 * Step 2 — External search + result picker (skipped for Gunpla)
 * Step 3 — Details form (pre-filled from search result)
 */
import { zodResolver } from '@hookform/resolvers/zod';
import type { ItemCreate, ItemType, SearchResult } from '@hobby-track/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  Gamepad2,
  Loader2,
  Package,
  Search,
  Tv2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { HttpError, createItem, searchQueryOptions } from '../lib/api';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Skeleton } from './ui/skeleton';
import { Textarea } from './ui/textarea';

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(value); }, ms);
    return () => { clearTimeout(t); };
  }, [value, ms]);
  return debounced;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG = [
  {
    type: 'game' as const,
    label: 'Game',
    icon: Gamepad2,
    description: 'Search RAWG database',
  },
  {
    type: 'anime' as const,
    label: 'Anime',
    icon: Tv2,
    description: 'Search MyAnimeList via Jikan',
  },
  {
    type: 'book' as const,
    label: 'Book',
    icon: BookOpen,
    description: 'Search Google Books',
  },
  {
    type: 'gunpla' as const,
    label: 'Gunpla',
    icon: Package,
    description: 'Manual entry + photo',
  },
] as const;

const STATUS_OPTIONS = [
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
] as const;

const TIME_OPTIONS = [
  { value: '', label: '— none —' },
  { value: 'short', label: 'Short (< 30 min)' },
  { value: 'medium', label: 'Medium (30 min – 1 hr)' },
  { value: 'long', label: 'Long (1–2 hrs)' },
  { value: 'very_long', label: 'Very long (2 hrs+)' },
] as const;

const LOAD_OPTIONS = [
  { value: '', label: '— none —' },
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'heavy', label: 'Heavy' },
] as const;

// ── Form schema ───────────────────────────────────────────────────────────────

const itemFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  status: z.enum(['wishlist', 'active', 'paused', 'completed', 'dropped']),
  priority: z.coerce.number().int().min(1).max(5),
  timeCommitment: z.string().optional(),
  mentalLoad: z.string().optional(),
  moodTags: z.string().optional(),
  coverUrl: z.string().max(2000).optional(),
  notes: z.string().max(10000).optional(),
  currentProgress: z.string().max(1000).optional(),
});
type ItemFormData = z.infer<typeof itemFormSchema>;

// ── Active limit warning (inline) ─────────────────────────────────────────────

interface ActiveLimitDetails {
  type: ItemType;
  currentActiveCount: number;
  limit: number;
}

function ActiveLimitWarning({
  details,
  onCancel,
  onForce,
  isPending,
}: {
  details: ActiveLimitDetails;
  onCancel: () => void;
  onForce: () => void;
  isPending: boolean;
}) {
  const typeLabel =
    { game: 'games', anime: 'anime series', book: 'books', gunpla: 'gunpla builds' }[
      details.type
    ];

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="space-y-3 flex-1">
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Active limit reached
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              You already have {details.currentActiveCount} of {details.limit} active{' '}
              {typeLabel}. Consider pausing one first, or add anyway.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 text-white hover:bg-amber-700"
              onClick={onForce}
              disabled={isPending}
            >
              {isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Add anyway
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Type picker ───────────────────────────────────────────────────────

function TypePickerStep({ onSelect }: { onSelect: (type: ItemType) => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add to backlog</DialogTitle>
        <DialogDescription>What are you tracking?</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        {TYPE_CONFIG.map(({ type, label, icon: Icon, description }) => (
          <button
            key={type}
            type="button"
            onClick={() => { onSelect(type); }}
            className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center transition-all hover:border-primary hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

// ── Step 2: Search ────────────────────────────────────────────────────────────

function SearchStep({
  type,
  onSelect,
  onSkip,
  onBack,
}: {
  type: Exclude<ItemType, 'gunpla'>;
  onSelect: (result: SearchResult) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 450);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data, isFetching, isError } = useQuery(
    searchQueryOptions(type, debouncedQuery),
  );

  const typeLabel =
    { game: 'games', anime: 'anime', book: 'books' }[type];

  return (
    <>
      <DialogHeader>
        <button
          type="button"
          onClick={() => { onBack(); }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 -ml-0.5"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <DialogTitle>Search {typeLabel}</DialogTitle>
        <DialogDescription>
          Pick a result to pre-fill details, or skip to enter manually.
        </DialogDescription>
      </DialogHeader>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={`Search ${typeLabel}…`}
          value={query}
          onChange={(e) => { setQuery(e.target.value); }}
          className="pl-9"
        />
      </div>

      <div className="max-h-72 overflow-y-auto space-y-1 -mx-6 px-6">
        {isFetching && (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-16 w-12 rounded shrink-0" />
                <div className="flex-1 space-y-1.5 py-1">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isFetching && isError && (
          <p className="py-4 text-center text-sm text-destructive">
            Search failed. Check your connection and try again.
          </p>
        )}

        {!isFetching && data?.results.length === 0 && debouncedQuery.trim().length >= 2 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No results for &ldquo;{debouncedQuery}&rdquo;
          </p>
        )}

        {!isFetching &&
          data?.results.map((result) => (
            <button
              key={result.externalId}
              type="button"
              onClick={() => { onSelect(result); }}
              className="flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent focus:outline-none focus-visible:bg-accent"
            >
              {result.coverUrl ? (
                <img
                  src={result.coverUrl}
                  alt={result.title}
                  className="h-16 w-12 rounded object-cover shrink-0"
                />
              ) : (
                <div className="h-16 w-12 rounded bg-muted shrink-0 flex items-center justify-center">
                  <Search className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
              <div className="flex-1 min-w-0 py-0.5">
                <p className="text-sm font-medium text-foreground leading-snug">
                  {result.title}
                </p>
                {result.releaseYear && (
                  <p className="text-xs text-muted-foreground">{result.releaseYear}</p>
                )}
                {result.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {result.description}
                  </p>
                )}
              </div>
            </button>
          ))}
      </div>

      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={() => { onSkip(); }}>
          Skip — enter manually
        </Button>
      </DialogFooter>
    </>
  );
}

// ── Step 3: Details form ──────────────────────────────────────────────────────

function ItemFormStep({
  type,
  prefill,
  onBack,
  onSuccess,
}: {
  type: ItemType;
  prefill: SearchResult | null;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const [activeLimitDetails, setActiveLimitDetails] = useState<ActiveLimitDetails | null>(
    null,
  );
  const [pendingData, setPendingData] = useState<ItemCreate | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemFormData>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      title: prefill?.title ?? '',
      status: 'wishlist',
      priority: 3,
      coverUrl: prefill?.coverUrl ?? '',
      timeCommitment: '',
      mentalLoad: '',
      moodTags: '',
      notes: '',
      currentProgress: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: ({ data, force }: { data: ItemCreate; force?: boolean }) =>
      createItem(data, force),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['items'] });
      toast.success('Added to backlog!');
      onSuccess();
    },
    onError: (err, vars) => {
      if (err instanceof HttpError && err.status === 409 && err.code === 'ACTIVE_LIMIT_EXCEEDED') {
        const details = err.details as ActiveLimitDetails;
        setActiveLimitDetails(details);
        setPendingData(vars.data);
      } else {
        toast.error('Failed to add item. Please try again.');
      }
    },
  });

  const buildPayload = (formData: ItemFormData): ItemCreate => ({
    type,
    title: formData.title,
    status: formData.status,
    priority: formData.priority,
    timeCommitment:
      (formData.timeCommitment as ItemCreate['timeCommitment']) ?? null,
    mentalLoad: (formData.mentalLoad as ItemCreate['mentalLoad']) ?? null,
    moodTags: formData.moodTags
      ? formData.moodTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : null,
    coverUrl: formData.coverUrl ? formData.coverUrl : null,
    notes: formData.notes ? formData.notes : null,
    currentProgress: formData.currentProgress ? formData.currentProgress : null,
    externalId: prefill?.externalId ?? null,
    externalSource: prefill?.source ?? null,
    metadata: prefill?.metadata ?? null,
    rating: null,
  });

  const onSubmit = (formData: ItemFormData) => {
    createMutation.mutate({ data: buildPayload(formData) });
  };

  const handleForce = () => {
    if (pendingData) {
      createMutation.mutate({ data: pendingData, force: true });
    }
    setActiveLimitDetails(null);
    setPendingData(null);
  };

  const handleCancelForce = () => {
    setActiveLimitDetails(null);
    setPendingData(null);
  };

  const isPending = createMutation.isPending;

  return (
    /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-0">
      <DialogHeader>
        <button
          type="button"
          onClick={() => { onBack(); }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 -ml-0.5"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <DialogTitle>Item details</DialogTitle>
        <DialogDescription>
          Fill in the details. Everything can be edited later.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1 -mr-1">
        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="add-title">Title *</Label>
          <Input id="add-title" {...register('title')} />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title.message}</p>
          )}
        </div>

        {/* Status + Priority row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="add-status">Status</Label>
            <select
              id="add-status"
              {...register('status')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-priority">Priority</Label>
            <select
              id="add-priority"
              {...register('priority')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value={1}>1 — Low</option>
              <option value={2}>2</option>
              <option value={3}>3 — Normal</option>
              <option value={4}>4</option>
              <option value={5}>5 — High</option>
            </select>
          </div>
        </div>

        {/* Time commitment + Mental load */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="add-time">Session length</Label>
            <select
              id="add-time"
              {...register('timeCommitment')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="add-load">Mental load</Label>
            <select
              id="add-load"
              {...register('mentalLoad')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {LOAD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cover URL */}
        <div className="space-y-1.5">
          <Label htmlFor="add-cover">Cover URL</Label>
          <Input
            id="add-cover"
            type="url"
            placeholder="https://…"
            {...register('coverUrl')}
          />
        </div>

        {/* Current progress */}
        <div className="space-y-1.5">
          <Label htmlFor="add-progress">Current progress</Label>
          <Input
            id="add-progress"
            placeholder='e.g. "Chapter 5", "Episode 12", "Gongaga Region"'
            {...register('currentProgress')}
          />
        </div>

        {/* Mood tags */}
        <div className="space-y-1.5">
          <Label htmlFor="add-moods">Mood tags</Label>
          <Input
            id="add-moods"
            placeholder="cozy, intense, story-rich (comma-separated)"
            {...register('moodTags')}
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="add-notes">Notes</Label>
          <Textarea
            id="add-notes"
            placeholder="Anything you want to remember…"
            className="min-h-[72px]"
            {...register('notes')}
          />
        </div>

        {/* Active limit warning */}
        {activeLimitDetails && (
          <ActiveLimitWarning
            details={activeLimitDetails}
            onCancel={handleCancelForce}
            onForce={handleForce}
            isPending={isPending}
          />
        )}
      </div>

      <DialogFooter className="mt-5">
        <Button type="submit" disabled={isPending} className="min-w-[100px]">
          {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Add to backlog
        </Button>
      </DialogFooter>
    </form>
  );
}

// ── Root dialog ───────────────────────────────────────────────────────────────

type Step = 'type' | 'search' | 'form';

interface AddItemDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AddItemDialog({ open, onClose }: AddItemDialogProps) {
  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<ItemType | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('type');
      setSelectedType(null);
      setSelectedResult(null);
    }
  }, [open]);

  const handleTypeSelect = (type: ItemType) => {
    setSelectedType(type);
    setSelectedResult(null);
    if (type === 'gunpla') {
      setStep('form');
    } else {
      setStep('search');
    }
  };

  const handleResultSelect = (result: SearchResult) => {
    setSelectedResult(result);
    setStep('form');
  };

  const handleSkipSearch = () => {
    setStep('form');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); } }}>
      <DialogContent className="max-w-lg">
        {step === 'type' && <TypePickerStep onSelect={handleTypeSelect} />}

        {step === 'search' && selectedType !== null && selectedType !== 'gunpla' && (
          <SearchStep
            type={selectedType}
            onSelect={handleResultSelect}
            onSkip={handleSkipSearch}
            onBack={() => { setStep('type'); }}
          />
        )}

        {step === 'form' && selectedType !== null && (
          <ItemFormStep
            type={selectedType}
            prefill={selectedResult}
            onBack={() => { setStep(selectedType === 'gunpla' ? 'type' : 'search'); }}
            onSuccess={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
