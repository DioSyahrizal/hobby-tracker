import { zodResolver } from '@hookform/resolvers/zod';
import type { SettingsUpdate } from '@hobby-track/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Skeleton } from '../components/ui/skeleton';
import { settingsQueryOptions, updateSettings } from '../lib/api';

export const Route = createFileRoute('/_app/settings/')({
  component: SettingsPage,
});

// ── Form schema ───────────────────────────────────────────────────────────────

const settingsFormSchema = z.object({
  activeLimitGame: z.coerce.number().int().min(0).max(100),
  activeLimitAnime: z.coerce.number().int().min(0).max(100),
  activeLimitBook: z.coerce.number().int().min(0).max(100),
  activeLimitGunpla: z.coerce.number().int().min(0).max(100),
  theme: z.enum(['light', 'dark', 'system']),
});
type SettingsForm = z.infer<typeof settingsFormSchema>;

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-12">
      <div className="sm:w-64 shrink-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex-1 space-y-4">{children}</div>
    </div>
  );
}

// ── Limit field ───────────────────────────────────────────────────────────────

function LimitField({
  id,
  label,
  description,
  error,
  registration,
}: {
  id: string;
  label: string;
  description: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<SettingsForm>>['register']>;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
        {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
      </div>
      <Input
        id={id}
        type="number"
        min={0}
        max={100}
        className="w-20 text-center"
        {...registration}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function SettingsPage() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery(settingsQueryOptions);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      activeLimitGame: 3,
      activeLimitAnime: 3,
      activeLimitBook: 2,
      activeLimitGunpla: 5,
      theme: 'system',
    },
  });

  // Populate form once settings load
  useEffect(() => {
    if (settings) {
      reset({
        activeLimitGame: settings.activeLimitGame,
        activeLimitAnime: settings.activeLimitAnime,
        activeLimitBook: settings.activeLimitBook,
        activeLimitGunpla: settings.activeLimitGunpla,
        theme: settings.theme,
      });
    }
  }, [settings, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: SettingsUpdate) => updateSettings(data),
    onSuccess: (updated) => {
      qc.setQueryData(settingsQueryOptions.queryKey, updated);
      reset({
        activeLimitGame: updated.activeLimitGame,
        activeLimitAnime: updated.activeLimitAnime,
        activeLimitBook: updated.activeLimitBook,
        activeLimitGunpla: updated.activeLimitGunpla,
        theme: updated.theme,
      });
      toast.success('Settings saved!');
    },
    onError: () => {
      toast.error('Failed to save settings. Please try again.');
    },
  });

  const onSubmit = (formData: SettingsForm) => {
    updateMutation.mutate(formData);
  };

  const divider = <hr className="border-border" />;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 space-y-8">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-px w-full" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-9 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your hobby-track experience.
        </p>
      </div>

      <div className="space-y-8">
        {divider}

        {/* Active limits */}
        <Section
          title="Active limits"
          description="Soft cap on how many items you can have active per type. You'll get a warning — not a hard block — when you go over."
        >
          <LimitField
            id="limit-game"
            label="Games"
            description="Default 3"
            error={errors.activeLimitGame?.message}
            registration={register('activeLimitGame')}
          />
          <LimitField
            id="limit-anime"
            label="Anime"
            description="Default 3"
            error={errors.activeLimitAnime?.message}
            registration={register('activeLimitAnime')}
          />
          <LimitField
            id="limit-book"
            label="Books"
            description="Default 2"
            error={errors.activeLimitBook?.message}
            registration={register('activeLimitBook')}
          />
          <LimitField
            id="limit-gunpla"
            label="Gunpla"
            description="Default 5"
            error={errors.activeLimitGunpla?.message}
            registration={register('activeLimitGunpla')}
          />
        </Section>

        {divider}

        {/* Theme */}
        <Section
          title="Appearance"
          description="Choose your preferred color scheme. System follows your OS setting."
        >
          <div className="space-y-1.5">
            <Label htmlFor="theme">Theme</Label>
            <select
              id="theme"
              {...register('theme')}
              className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Dark mode theming is applied on save (full implementation in Phase 8).
            </p>
          </div>
        </Section>

        {divider}

        {/* Save button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={updateMutation.isPending || !isDirty}
            className="min-w-[120px]"
          >
            {updateMutation.isPending && (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            )}
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}
