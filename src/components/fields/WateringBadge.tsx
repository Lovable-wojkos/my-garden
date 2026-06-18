import { Badge } from "@/components/ui/badge";
import { pl } from "@/lib/copy/pl";
import type { WateringStatus } from "@/lib/watering";
import { cn } from "@/lib/utils";

interface WateringBadgeProps {
  status: WateringStatus;
  variant?: "compact" | "default";
}

const statusLabels: Record<Exclude<WateringStatus, "unknown">, { default: string; compact: string }> = {
  ok: { default: pl.watering.ok, compact: pl.watering.okShort },
  water_soon: { default: pl.watering.waterSoon, compact: pl.watering.waterSoonShort },
  water_now: { default: pl.watering.waterNow, compact: pl.watering.waterNowShort },
};

const statusClasses: Record<Exclude<WateringStatus, "unknown">, string> = {
  ok: "bg-muted text-muted-foreground border-border",
  water_soon: "border-accent/40 bg-accent/10 text-accent-foreground",
  water_now: "bg-accent text-accent-foreground border-transparent",
};

export default function WateringBadge({ status, variant = "default" }: WateringBadgeProps) {
  if (status === "unknown") return null;

  const label = statusLabels[status][variant];

  return (
    <Badge
      variant="outline"
      className={cn("text-xs font-medium", variant === "compact" && "px-1.5 py-0", statusClasses[status])}
    >
      {label}
    </Badge>
  );
}
