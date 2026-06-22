import { useState } from "react";
import { pl } from "@/lib/copy/pl";
import { cn } from "@/lib/utils";

interface WaterButtonProps {
  fieldId?: string | null;
  label: string;
  className?: string;
}

export default function WaterButton({ fieldId, label, className }: WaterButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/watering-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_id: fieldId ?? null }),
      });

      if (!response.ok) {
        setError(`${pl.watering.waterError} (${response.status})`);
        return;
      }

      window.location.reload();
    } catch {
      setError(pl.watering.waterError);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={cn(
          "border-border bg-background hover:bg-muted inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
          className,
        )}
      >
        {isPending ? (
          <span className="flex items-center gap-2">
            <span className="border-foreground/30 border-t-foreground size-3.5 animate-spin rounded-full border-2" />…
          </span>
        ) : (
          label
        )}
      </button>
      {error ? <span className="text-destructive max-w-40 text-right text-xs">{error}</span> : null}
    </div>
  );
}
