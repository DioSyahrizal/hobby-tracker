/**
 * Slide-over sheet for viewing and editing an item.
 * Handles status changes with active-limit guard, cover upload for gunpla,
 * and item deletion with inline confirmation.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import type { Item, ItemType, ItemUpdate } from '@hobby-track/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { HttpError, createMoodTagApi, deleteItem, moodTagsQueryOptions, updateItem, uploadCover } from '../lib/api';
import { MultiSelect, type SelectOption } from './ui/multi-select';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from './ui/sheet';
import { Skeleton } from './ui/skeleton';
import { Textarea } from './ui/textarea';

// ── Constants ─────────────────────────────────────────────────────────────────

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

const TYPE_LABEL: Record<ItemType, string> = {
  game: 'Game',
  anime: 'Anime',
  book: 'Book',
  gunpla: 'Gunpla',
};

// ── Form schema ───────────────────────────────────────────────────────────────

const editFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  status: z.enum(['wishlist', 'active', 'paused', 'completed', 'dropped']),
  priority: z.coerce.number().int().min(1).max(5),
  timeCommitment: z.string().optional(),
  mentalLoad: z.string().optional(),
  coverUrl: z.string().max(2000).optional(),
  currentProgress: z.string().max(1000).optional(),
  notes: z.string().max(10000).optional(),
  rating: z.coerce.number().int().min(1).max(10).optional().or(z.literal('')),
});
type EditFormData = z.infer<typeof editFormSchema>;

// ── Active limit warning ──────────────────────────────────────────────────────

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
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Active limit reached
            </p>
            <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
              You already have {details.currentActiveCount} of {details.limit} active{' '}
              {typeLabel}. Pause one first, or continue anyway.
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
              Continue anyway
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function itemToFormValues(item: Item): EditFormData {
  return {
    title: item.title,
    status: item.status,
    priority: item.priority,
    timeCommitment: item.timeCommitment ?? '',
    mentalLoad: item.mentalLoad ?? '',
    coverUrl: item.coverUrl ?? '',
    currentProgress: item.currentProgress ?? '',
    notes: item.notes ?? '',
    rating: item.rating ?? '',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ItemDetailSheetProps {
  item: Item;
  open: boolean;
  onClose: () => void;
}

export function ItemDetailSheet({ item: initialItem, open, onClose }: ItemDetailSheetProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [item, setItem] = useState(initialItem);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [activeLimitDetails, setActiveLimitDetails] = useState<ActiveLimitDetails | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<ItemUpdate | null>(null);

  // Mood tags — managed outside RHF because it's a controlled multi-select
  const [selectedMoodTags, setSelectedMoodTags] = useState<SelectOption[]>(
    () => item.moodTags.map((t) => ({ value: t.id, label: t.name })),
  );

  // Sync when the parent item reference changes (e.g. after list refetch)
  useEffect(() => {
    setItem(initialItem);
  }, [initialItem.id]); // intentionally watching only id — full object sync via reset()

  // Reset transient state when sheet closes
  useEffect(() => {
    if (!open) {
      setDeleteConfirm(false);
      setActiveLimitDetails(null);
      setPendingUpdate(null);
    }
  }, [open]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema),
    defaultValues: itemToFormValues(item),
  });

  // Keep form in sync when item changes after save
  useEffect(() => {
    reset(itemToFormValues(item));
    setSelectedMoodTags(item.moodTags.map((t) => ({ value: t.id, label: t.name })));
  }, [item, reset]);

  // Available mood tags from the API
  const { data: moodTagsData } = useQuery(moodTagsQueryOptions);
  const moodTagOptions: SelectOption[] = useMemo(
    () => moodTagsData?.tags.map((t) => ({ value: t.id, label: t.name })) ?? [],
    [moodTagsData],
  );

  // Dirty flag for mood tags (RHF's isDirty doesn't cover external state)
  const moodTagsDirty = useMemo(() => {
    const origSet = new Set(item.moodTags.map((t) => t.id));
    const currSet = new Set(selectedMoodTags.map((t) => t.value));
    if (origSet.size !== currSet.size) return true;
    for (const id of origSet) if (!currSet.has(id)) return true;
    return false;
  }, [item.moodTags, selectedMoodTags]);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: ({ data, force }: { data: ItemUpdate; force?: boolean }) =>
      updateItem(item.id, data, force),
    onSuccess: (updated) => {
      setItem(updated);
      void qc.invalidateQueries({ queryKey: ['items'] });
      toast.success('Saved!');
    },
    onError: (err, vars) => {
      if (
        err instanceof HttpError &&
        err.status === 409 &&
        err.code === 'ACTIVE_LIMIT_EXCEEDED'
      ) {
        const details = err.details as ActiveLimitDetails;
        setActiveLimitDetails(details);
        setPendingUpdate(vars.data);
      } else {
        toast.error('Failed to save. Please try again.');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteItem(item.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['items'] });
      toast.success(`"${item.title}" deleted.`);
      onClose();
    },
    onError: () => {
      toast.error('Failed to delete. Please try again.');
    },
  });

  const coverMutation = useMutation({
    mutationFn: (file: File) => uploadCover(item.id, file),
    onSuccess: (updated) => {
      setItem(updated);
      void qc.invalidateQueries({ queryKey: ['items'] });
      toast.success('Cover updated!');
    },
    onError: () => {
      toast.error('Upload failed. Max 5 MB, JPEG / PNG / WebP only.');
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const buildPayload = (formData: EditFormData): ItemUpdate => ({
    title: formData.title,
    status: formData.status,
    priority: formData.priority,
    timeCommitment: formData.timeCommitment
      ? (formData.timeCommitment as ItemUpdate['timeCommitment'])
      : null,
    mentalLoad: formData.mentalLoad
      ? (formData.mentalLoad as ItemUpdate['mentalLoad'])
      : null,
    moodTagIds: selectedMoodTags.map((t) => t.value),
    coverUrl: formData.coverUrl !== '' ? (formData.coverUrl ?? null) : null,
    currentProgress: formData.currentProgress !== '' ? (formData.currentProgress ?? null) : null,
    notes: formData.notes !== '' ? (formData.notes ?? null) : null,
    rating: formData.rating !== '' && formData.rating != null ? formData.rating : null,
  });

  const onSubmit = (formData: EditFormData) => {
    updateMutation.mutate({ data: buildPayload(formData) });
  };

  const handleForce = () => {
    if (pendingUpdate) {
      updateMutation.mutate({ data: pendingUpdate, force: true });
    }
    setActiveLimitDetails(null);
    setPendingUpdate(null);
  };

  const handleCoverFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      coverMutation.mutate(file);
      e.target.value = ''; // reset so same file can be re-selected
    }
  };

  const handleCreateMoodTag = async (label: string): Promise<SelectOption> => {
    const created = await createMoodTagApi({ name: label });
    await qc.invalidateQueries({ queryKey: ['mood-tags'] });
    return { value: created.id, label: created.name };
  };

  const isPending =
    updateMutation.isPending || deleteMutation.isPending || coverMutation.isPending;

  const selectClass =
    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent>
        {/* ── Header ── */}
        <SheetHeader>
          <SheetTitle className="line-clamp-1 pr-2">{item.title}</SheetTitle>
          <SheetDescription>{TYPE_LABEL[item.type]}</SheetDescription>
        </SheetHeader>

        {/* ── Scrollable body ── */}
        {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
        <form id="edit-form" onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="space-y-5 px-6 py-5">

            {/* Cover preview */}
            {item.coverUrl && (
              <div className="flex justify-center">
                <img
                  src={item.coverUrl}
                  alt={item.title}
                  className="max-h-40 rounded-lg object-contain shadow"
                />
              </div>
            )}

            {/* Cover upload — gunpla only */}
            {item.type === 'gunpla' && (
              <div className="space-y-1.5">
                <Label>Cover image</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleCoverFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={coverMutation.isPending}
                >
                  {coverMutation.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-4 w-4" />
                  )}
                  {item.coverUrl ? 'Replace cover' : 'Upload cover'}
                </Button>
                {coverMutation.isPending && (
                  <Skeleton className="h-1.5 w-full rounded-full" />
                )}
              </div>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Title</Label>
              <Input id="edit-title" {...register('title')} />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>

            {/* Status + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-status">Status</Label>
                <select id="edit-status" {...register('status')} className={selectClass}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-priority">Priority</Label>
                <select id="edit-priority" {...register('priority')} className={selectClass}>
                  <option value={1}>1 — Low</option>
                  <option value={2}>2</option>
                  <option value={3}>3 — Normal</option>
                  <option value={4}>4</option>
                  <option value={5}>5 — High</option>
                </select>
              </div>
            </div>

            {/* Time + Load */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-time">Session length</Label>
                <select id="edit-time" {...register('timeCommitment')} className={selectClass}>
                  {TIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-load">Mental load</Label>
                <select id="edit-load" {...register('mentalLoad')} className={selectClass}>
                  {LOAD_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Current progress */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-progress">Current progress</Label>
              <Input
                id="edit-progress"
                placeholder='e.g. "Chapter 5", "Episode 12"'
                {...register('currentProgress')}
              />
            </div>

            {/* Cover URL (non-gunpla can manually change it) */}
            {item.type !== 'gunpla' && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-cover">Cover URL</Label>
                <Input
                  id="edit-cover"
                  type="url"
                  placeholder="https://…"
                  {...register('coverUrl')}
                />
              </div>
            )}

            {/* Mood tags */}
            <div className="space-y-1.5">
              <Label>Mood tags</Label>
              <MultiSelect
                options={moodTagOptions}
                value={selectedMoodTags}
                onChange={setSelectedMoodTags}
                onCreateOption={handleCreateMoodTag}
                placeholder="Select mood tags…"
                disabled={isPending}
              />
            </div>

            {/* Rating */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-rating">Rating (1–10)</Label>
              <select id="edit-rating" {...register('rating')} className={selectClass}>
                <option value="">— not rated —</option>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                placeholder="Anything you want to remember…"
                className="min-h-[96px]"
                {...register('notes')}
              />
            </div>

            {/* Active limit warning */}
            {activeLimitDetails && (
              <ActiveLimitWarning
                details={activeLimitDetails}
                onCancel={() => { setActiveLimitDetails(null); setPendingUpdate(null); }}
                onForce={handleForce}
                isPending={updateMutation.isPending}
              />
            )}

            {/* Timestamps (read-only) */}
            <div className="space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
              {item.startedAt && (
                <p>Started: {new Date(item.startedAt).toLocaleDateString()}</p>
              )}
              {item.completedAt && (
                <p>Completed: {new Date(item.completedAt).toLocaleDateString()}</p>
              )}
              <p>Added: {new Date(item.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </form>

        {/* ── Footer ── */}
        <SheetFooter>
          {/* Delete side */}
          <div>
            {deleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Are you sure?</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => { setDeleteConfirm(false); }}
                  disabled={deleteMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => { deleteMutation.mutate(); }}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending && (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  )}
                  Delete
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => { setDeleteConfirm(true); }}
                disabled={isPending}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>

          {/* Save side */}
          <Button
            type="submit"
            form="edit-form"
            disabled={isPending || (!isDirty && !moodTagsDirty)}
            className="min-w-[80px]"
          >
            {updateMutation.isPending && (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            )}
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
