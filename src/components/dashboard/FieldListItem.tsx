import type { WateringStatus } from "@/lib/watering";
import { pl } from "@/lib/copy/pl";
import WateringBadge from "@/components/fields/WateringBadge";
import WaterButton from "@/components/dashboard/WaterButton";

interface FieldListItemProps {
  fieldId: string;
  name: string;
  sizeLabel: string;
  wateringStatus: WateringStatus | null;
}

export default function FieldListItem({ fieldId, name, sizeLabel, wateringStatus }: FieldListItemProps) {
  return (
    <div
      role="none"
      className="border-border bg-card hover:bg-muted flex items-center justify-between gap-3 rounded-xl border p-4 shadow-sm transition-colors"
    >
      <a
        href={`/dashboard/fields/${fieldId}`}
        className="min-w-0 flex-1 rounded-lg outline-offset-2 focus-visible:outline-2"
      >
        <p className="text-foreground font-semibold">{name}</p>
        <p className="text-muted-foreground text-sm">{sizeLabel}</p>
      </a>
      <div className="flex shrink-0 items-center gap-2">
        {wateringStatus ? <WateringBadge status={wateringStatus} variant="compact" /> : null}
        <WaterButton fieldId={fieldId} label={pl.watering.waterFieldButton} />
        <span className="text-muted-foreground" aria-hidden="true">
          →
        </span>
      </div>
    </div>
  );
}
