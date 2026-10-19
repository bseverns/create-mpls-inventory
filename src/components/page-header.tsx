export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}
