import { useState } from "react";
import type { FieldRow, PlantingRow, PlantRow } from "@/types";
import { getHarvestDate } from "@/lib/harvest";
import { evaluatePlantingWatering } from "@/lib/watering";
import { pl } from "@/lib/copy/pl";
import { cn } from "@/lib/utils";
import PlantingDialog from "./PlantingDialog";
import WateringBadge from "./WateringBadge";

interface FieldGridProps {
  field: FieldRow;
  plantings: PlantingRow[];
  plants: PlantRow[];
  rainfall7dMm?: number | null;
}

export default function FieldGrid({ field, plantings: initialPlantings, plants, rainfall7dMm = null }: FieldGridProps) {
  const [plantings, setPlantings] = useState<PlantingRow[]>(initialPlantings);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const plantingMap = new Map<string, PlantingRow>();
  for (const p of plantings) {
    plantingMap.set(`${p.cell_row}:${p.cell_col}`, p);
  }

  function openCell(row: number, col: number) {
    setSelectedCell({ row, col });
    setDialogOpen(true);
  }

  async function refetch() {
    const res = await fetch(`/api/plantings?field_id=${field.id}`);
    if (res.ok) {
      const data = (await res.json()) as PlantingRow[];
      setPlantings(data);
    }
  }

  const existingPlanting = selectedCell ? (plantingMap.get(`${selectedCell.row}:${selectedCell.col}`) ?? null) : null;

  return (
    <div>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${field.cols}, minmax(0, 1fr))` }}
        aria-label={`Field grid ${field.rows} rows by ${field.cols} columns`}
      >
        {Array.from({ length: field.rows }, (_, row) =>
          Array.from({ length: field.cols }, (_, col) => {
            const planting = plantingMap.get(`${row}:${col}`);
            const wateringStatus =
              planting && rainfall7dMm != null ? evaluatePlantingWatering(planting, plants, rainfall7dMm) : null;
            return (
              <button
                key={`${row}:${col}`}
                onClick={() => {
                  openCell(row, col);
                }}
                className={cn(
                  "focus-visible:ring-ring flex min-h-11 min-w-11 flex-col items-start rounded-lg border p-2 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  planting
                    ? "border-primary/30 bg-primary/10 hover:bg-primary/15"
                    : "border-border bg-muted/50 hover:bg-muted",
                )}
                aria-label={
                  planting
                    ? `Cell (${row},${col}) planted with ${planting.plant_name ?? pl.fields.unknownPlant}`
                    : `Cell (${row},${col}) empty`
                }
              >
                {planting ? (
                  <>
                    <span className="text-foreground font-semibold">
                      {planting.plant_name ?? pl.fields.unknownPlant}
                    </span>
                    <span className="text-muted-foreground">{planting.seeding_date}</span>
                    <span className="text-muted-foreground">🌾 {getHarvestDate(planting, plants)}</span>
                    {wateringStatus && wateringStatus !== "unknown" ? (
                      <WateringBadge status={wateringStatus} variant="compact" />
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">{pl.fields.emptyCell}</span>
                )}
              </button>
            );
          }),
        )}
      </div>

      {selectedCell && (
        <PlantingDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          fieldId={field.id}
          cellRow={selectedCell.row}
          cellCol={selectedCell.col}
          existingPlanting={existingPlanting}
          plants={plants}
          onSuccess={() => {
            setDialogOpen(false);
            void refetch();
          }}
        />
      )}
    </div>
  );
}
