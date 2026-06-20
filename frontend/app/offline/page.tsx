export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="text-2xl font-bold tracking-tight">
        Smart<span className="text-primary">POS</span>
      </div>
      <p className="text-sm text-muted-foreground">
        You&apos;re offline. Reconnect to continue using the POS.
      </p>
    </div>
  );
}
