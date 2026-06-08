import { useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { getHarvestDate } from "@/lib/harvest";
import type { PlantingRow, PlantRow } from "@/types";

interface PlantingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldId: string;
  cellRow: number;
  cellCol: number;
  existingPlanting: PlantingRow | null;
  plants: PlantRow[];
  onSuccess: () => void;
}

export default function PlantingDialog({
  open,
  onOpenChange,
  fieldId,
  cellRow,
  cellCol,
  existingPlanting,
  plants,
  onSuccess,
}: PlantingDialogProps) {
  const today = new Date().toISOString().slice(0, 10);

  const [plantId, setPlantId] = useState<string | null>(existingPlanting?.plant_id ?? null);
  const [plantName, setPlantName] = useState(existingPlanting?.plant_name ?? "");
  const [seedingDate, setSeedingDate] = useState(existingPlanting?.seeding_date ?? today);
  const [notes, setNotes] = useState(existingPlanting?.notes ?? "");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEditMode = existingPlanting != null;

  // Build a fake planting for harvest date preview
  const previewPlanting: PlantingRow = {
    id: "",
    field_id: fieldId,
    user_id: "",
    plant_id: plantId,
    plant_name: plantName || null,
    cell_row: cellRow,
    cell_col: cellCol,
    seeding_date: seedingDate,
    notes: notes || null,
    created_at: "",
    updated_at: "",
  };
  const harvestPreview = getHarvestDate(previewPlanting, plants);

  const selectedPlant = plants.find((p) => p.id === plantId);

  function handleSelectCatalogPlant(id: string) {
    const plant = plants.find((p) => p.id === id);
    if (plant) {
      setPlantId(plant.id);
      setPlantName(plant.name);
    }
    setCatalogOpen(false);
  }

  function handleTextEntry(value: string) {
    setPlantName(value);
    setPlantId(null); // Free-text clears catalog selection
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!plantId && !plantName.trim()) {
      setError("Enter a plant name or select from the catalog.");
      return;
    }

    setLoading(true);
    try {
      let res: Response;
      if (isEditMode) {
        res = await fetch(`/api/plantings/${existingPlanting.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plant_id: plantId,
            plant_name: plantName.trim() || null,
            seeding_date: seedingDate,
            notes: notes.trim() || null,
          }),
        });
      } else {
        res = await fetch("/api/plantings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field_id: fieldId,
            plant_id: plantId,
            plant_name: plantName.trim() || null,
            cell_row: cellRow,
            cell_col: cellCol,
            seeding_date: seedingDate,
            notes: notes.trim() || null,
          }),
        });
      }

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const apiError = json.error as string | undefined;
        const fieldErrors = json.errors as Record<string, string[]> | undefined;
        const errorMsg = apiError ?? (fieldErrors ? Object.values(fieldErrors).flat().join(", ") : "");
        setError(errorMsg || "Something went wrong.");
        return;
      }

      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!isEditMode) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/plantings/${existingPlanting.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to delete planting.");
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-slate-900 text-white">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit planting" : "Add planting"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Catalog combobox */}
          <div className="space-y-1">
            <Label>Select from catalog</Label>
            <Popover open={catalogOpen} onOpenChange={setCatalogOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={catalogOpen}
                  className="w-full justify-between border-white/20 bg-white/5"
                >
                  {selectedPlant?.name ?? "Search catalog…"}
                  <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search plants…" />
                  <CommandList>
                    <CommandEmpty>No plants in catalog yet — enter a name manually below.</CommandEmpty>
                    <CommandGroup>
                      {plants.map((plant) => (
                        <CommandItem
                          key={plant.id}
                          value={plant.name}
                          onSelect={() => {
                            handleSelectCatalogPlant(plant.id);
                          }}
                        >
                          <CheckIcon
                            className={cn("mr-2 h-4 w-4", plantId === plant.id ? "opacity-100" : "opacity-0")}
                          />
                          {plant.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Free-text name */}
          <div className="space-y-1">
            <Label htmlFor="plant-name">Or enter plant name</Label>
            <Input
              id="plant-name"
              value={plantName}
              onChange={(e) => {
                handleTextEntry(e.target.value);
              }}
              placeholder="e.g. Courgette"
              maxLength={100}
              className="border-white/20 bg-white/5"
            />
          </div>

          {/* Seeding date */}
          <div className="space-y-1">
            <Label htmlFor="seeding-date">Seeding date</Label>
            <Input
              id="seeding-date"
              type="date"
              value={seedingDate}
              onChange={(e) => {
                setSeedingDate(e.target.value);
              }}
              required
              className="border-white/20 bg-white/5"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
              maxLength={500}
              rows={3}
              placeholder="Any additional notes…"
              className="w-full rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:ring-2 focus:ring-white/20 focus:outline-none"
            />
          </div>

          {/* Harvest date preview */}
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <span className="text-blue-100/60">Estimated harvest: </span>
            <span className="font-medium text-white">{harvestPreview}</span>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {isEditMode && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="sm:mr-auto"
              >
                {confirmDelete ? "Confirm delete?" : "Delete"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEditMode ? "Update" : "Plant"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
