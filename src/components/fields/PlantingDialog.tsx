import { useState } from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { pl } from "@/lib/copy/pl";
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
    setPlantId(null);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const createBody = {
        field_id: fieldId,
        cell_row: cellRow,
        cell_col: cellCol,
        plant_id: plantId,
        plant_name: plantName.trim() || null,
        seeding_date: seedingDate,
        notes: notes.trim() || null,
      };

      const updateBody = {
        plant_id: plantId,
        plant_name: plantName.trim() || null,
        seeding_date: seedingDate,
        notes: notes.trim() || null,
      };

      const res = isEditMode
        ? await fetch(`/api/plantings/${existingPlanting.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updateBody),
          })
        : await fetch("/api/plantings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createBody),
          });

      if (!res.ok) {
        setError(pl.fields.errors.general);
        return;
      }

      onSuccess();
    } catch {
      setError(pl.fields.errors.network);
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
        setError(pl.fields.errors.general);
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditMode ? pl.fields.plantingEditTitle : pl.fields.plantingAddTitle}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{pl.fields.catalogSelectLabel}</Label>
            <Popover open={catalogOpen} onOpenChange={setCatalogOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={catalogOpen}
                  className="w-full justify-between"
                >
                  {selectedPlant?.name ?? pl.fields.plantPlaceholder}
                  <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder={pl.fields.plantSearch} />
                  <CommandList>
                    <CommandEmpty>{pl.fields.catalogEmpty}</CommandEmpty>
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

          <div className="space-y-1.5">
            <Label htmlFor="plant-name">{pl.fields.plantManualLabel}</Label>
            <Input
              id="plant-name"
              value={plantName}
              onChange={(e) => {
                handleTextEntry(e.target.value);
              }}
              placeholder={pl.plantRequests.formPlaceholder}
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seeding-date">{pl.fields.seedingDateLabel}</Label>
            <Input
              id="seeding-date"
              type="date"
              value={seedingDate}
              onChange={(e) => {
                setSeedingDate(e.target.value);
              }}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">{pl.fields.notesLabel}</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
              maxLength={500}
              rows={3}
              placeholder={pl.fields.notesPlaceholder}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-20 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>

          <div className="border-border bg-muted/50 rounded-lg border px-3 py-2 text-sm">
            <span className="text-muted-foreground">{pl.fields.harvestEstimate}: </span>
            <span className="text-foreground font-medium">{harvestPreview}</span>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {isEditMode && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
                className="sm:mr-auto"
              >
                {confirmDelete ? pl.fields.deleteConfirmButton : pl.fields.deletePlanting}
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
              {pl.common.cancel}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? pl.fields.savePending : isEditMode ? pl.fields.updatePlanting : pl.fields.plantButton}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
