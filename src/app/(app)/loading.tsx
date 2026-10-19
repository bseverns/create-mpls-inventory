export default function LoadingPage() {
  return (
    <div role="status" aria-label="Loading">
      <div className="mb-6 animate-pulse">
        <div className="h-8 w-64 rounded-md bg-muted" />
        <div className="mt-2 h-4 w-80 max-w-full rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((cardNumber) => (
          <div
            key={cardNumber}
            className="animate-pulse overflow-hidden rounded-lg border bg-card"
          >
            <div className="aspect-[4/3] bg-muted" />
            <div className="grid gap-2 p-3">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
