import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/items/')({
  component: ItemsPage,
});

function ItemsPage() {
  return (
    <div className="p-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Your backlog</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Items list coming in Phase 6.
      </p>
    </div>
  );
}
