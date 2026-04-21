import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: number;
  label: string;
}

interface MultiSelectProps {
  options: SelectOption[];
  value: SelectOption[];
  onChange: (value: SelectOption[]) => void;
  /** Called when user types a name that doesn't exist. Return the created option. */
  onCreateOption?: (label: string) => Promise<SelectOption>;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  value,
  onChange,
  onCreateOption,
  placeholder = 'Select tags…',
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedIds = new Set(value.map((v) => v.value));

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );

  const exactMatch = options.some(
    (o) => o.label.toLowerCase() === query.toLowerCase().trim(),
  );
  const canCreate = onCreateOption && query.trim().length > 0 && !exactMatch;

  const toggle = (option: SelectOption) => {
    if (selectedIds.has(option.value)) {
      onChange(value.filter((v) => v.value !== option.value));
    } else {
      onChange([...value, option]);
    }
  };

  const remove = (option: SelectOption) => {
    onChange(value.filter((v) => v.value !== option.value));
  };

  const handleCreate = async () => {
    if (!onCreateOption || !canCreate || creating) return;
    setCreating(true);
    try {
      const created = await onCreateOption(query.trim());
      onChange([...value, created]);
      setQuery('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          className={cn(
            'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            open && 'ring-2 ring-ring',
          )}
        >
          {value.length === 0 && (
            <span className="text-muted-foreground px-1">{placeholder}</span>
          )}
          {value.map((v) => (
            <span
              key={v.value}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {v.label}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(v);
                }}
                className="ml-0.5 rounded-full hover:bg-primary/20"
                aria-label={`Remove ${v.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 w-[--radix-popover-trigger-width] rounded-md border border-border bg-popover p-1 shadow-md"
          sideOffset={4}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
        >
          {/* Search input */}
          <div className="flex items-center border-b border-border px-2 pb-1 mb-1">
            <input
              ref={inputRef}
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setQuery(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (canCreate) void handleCreate();
                }
              }}
              placeholder="Search or create…"
              className="w-full bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Options list */}
          <div
            className="max-h-52 overflow-y-auto overscroll-contain touch-pan-y"
            onWheel={(e) => { e.stopPropagation(); }}
            onTouchMove={(e) => { e.stopPropagation(); }}
          >
            {filtered.length === 0 && !canCreate && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No tags found.
              </p>
            )}

            {filtered.map((option) => {
              const selected = selectedIds.has(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { toggle(option); }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                    'hover:bg-accent hover:text-accent-foreground',
                    selected && 'font-medium',
                  )}
                >
                  <Check className={cn('h-4 w-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
                  {option.label}
                </button>
              );
            })}

            {/* Create option */}
            {canCreate && (
              <button
                type="button"
                onClick={() => { void handleCreate(); }}
                disabled={creating}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent"
              >
                <Plus className="h-4 w-4 shrink-0" />
                {creating ? 'Creating…' : `Create "${query.trim()}"`}
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
