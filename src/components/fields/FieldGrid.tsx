import { useState } from "react";
import type { FieldRow, PlantingRow, PlantRow } from "@/types";
import { getHarvestDate } from "@/lib/harvest";
import PlantingDialog from "./PlantingDialog";

interface FieldGridProps {
  field: FieldRow;
  plantings: PlantingRow[];
  plants: PlantRow[];
}

export default function FieldGrid({ field, plantings: initialPlantings, plants }: FieldGridProps) {
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
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${field.cols}, minmax(0, 1fr))` }}
        aria-label={`Field grid ${field.rows} rows by ${field.cols} columns`}
      >
        {Array.from({ length: field.rows }, (_, row) =>
          Array.from({ length: field.cols }, (_, col) => {
            const planting = plantingMap.get(`${row}:${col}`);
            return (
              <button
                key={`${row}:${col}`}
                onClick={() => {
                  openCell(row, col);
                }}
                className="flex min-h-[72px] flex-col items-start rounded-lg border border-white/20 bg-white/5 p-2 text-left text-xs transition-colors hover:bg-white/10"
                aria-label={
                  planting
                    ? `Cell (${row},${col}) planted with ${planting.plant_name ?? "unknown"}`
                    : `Cell (${row},${col}) empty`
                }
              >
                {planting ? (
                  <>
                    <span className="font-semibold text-white">{planting.plant_name ?? "Unknown"}</span>
                    <span className="text-blue-100/70">{planting.seeding_date}</span>
                    <span className="text-blue-100/50">🌾 {getHarvestDate(planting, plants)}</span>
                  </>
                ) : (
                  <span className="text-blue-100/40">Empty</span>
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
