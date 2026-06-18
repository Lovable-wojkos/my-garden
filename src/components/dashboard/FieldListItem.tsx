import type { WateringStatus } from "@/lib/watering";
import WateringBadge from "@/components/fields/WateringBadge";

interface FieldListItemProps {
  fieldId: string;
  name: string;
  sizeLabel: string;
  wateringStatus: WateringStatus | null;
}

export default function FieldListItem({ fieldId, name, sizeLabel, wateringStatus }: FieldListItemProps) {
  return (
    <a
      href={`/dashboard/fields/${fieldId}`}
      className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-xl border p-4 shadow-sm transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-foreground font-semibold">{name}</p>
        <p className="text-muted-foreground text-sm">{sizeLabel}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {wateringStatus ? <WateringBadge status={wateringStatus} variant="compact" /> : null}
        <span className="text-muted-foreground" aria-hidden="true">
          →
        </span>
      </div>
    </a>
  );
}
