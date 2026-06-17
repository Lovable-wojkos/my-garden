import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pl } from "@/lib/copy/pl";
import type { PlantRow } from "@/types";

interface Props {
  initialPlants: PlantRow[];
}

interface FormErrors {
  [key: string]: string[] | undefined;
  growth_days?: string[];
  watering_needs?: string[];
  general?: string[];
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function truncateUserId(userId: string | null) {
  if (!userId) {
    return pl.admin.unknownUser;
  }

  if (userId.length <= 12) {
    return userId;
  }

  return `${userId.slice(0, 8)}...${userId.slice(-4)}`;
}

export default function AdminPlantRequestList({ initialPlants }: Props) {
  const [plants, setPlants] = useState<PlantRow[]>(initialPlants);
  const [approvalTarget, setApprovalTarget] = useState<PlantRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PlantRow | null>(null);
  const [growthDays, setGrowthDays] = useState("");
  const [wateringNeeds, setWateringNeeds] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [activePlantId, setActivePlantId] = useState<string | null>(null);

  const closeApprovalDialog = () => {
    if (loading) {
      return;
    }

    setApprovalTarget(null);
    setGrowthDays("");
    setWateringNeeds("");
    setErrors({});
  };

  const handleApproveSubmit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!approvalTarget) {
      return;
    }

    setLoading(true);
    setActivePlantId(approvalTarget.id);
    setErrors({});

    const response = await fetch(`/api/admin/plant-requests/${approvalTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        growth_days: Number.parseInt(growthDays, 10),
        watering_needs: wateringNeeds.trim() ? wateringNeeds.trim() : undefined,
      }),
    });

    const payload = (await response.json()) as { errors?: FormErrors; error?: string };

    if (!response.ok) {
      if (response.status === 422 && payload.errors) {
        setErrors(payload.errors);
      } else {
        setErrors({ general: [payload.error ?? pl.admin.errors.approveFailed] });
      }
      setLoading(false);
      setActivePlantId(null);
      return;
    }

    setPlants((currentPlants) => currentPlants.filter((plant) => plant.id !== approvalTarget.id));
    setApprovalTarget(null);
    setGrowthDays("");
    setWateringNeeds("");
    setErrors({});
    setLoading(false);
    setActivePlantId(null);
  };

  const handleReject = async (plant: PlantRow) => {
    setLoading(true);
    setActivePlantId(plant.id);
    setErrors({});

    const response = await fetch(`/api/admin/plant-requests/${plant.id}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setErrors({ general: [payload.error ?? pl.admin.errors.rejectFailed] });
      setLoading(false);
      setActivePlantId(null);
      return;
    }

    setPlants((currentPlants) => currentPlants.filter((currentPlant) => currentPlant.id !== plant.id));
    setRejectTarget(null);
    setLoading(false);
    setActivePlantId(null);
  };

  return (
    <div className="space-y-4">
      {errors.general && !approvalTarget && (
        <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
          {errors.general[0]}
        </p>
      )}

      {plants.length === 0 ? (
        <p className="text-muted-foreground text-sm">{pl.admin.empty}</p>
      ) : (
        <ul className="space-y-3">
          {plants.map((plant) => (
            <li key={plant.id} className="border-border bg-card rounded-lg border p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-foreground font-semibold">{plant.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {pl.admin.created}: {formatCreatedAt(plant.created_at)}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {pl.admin.user}: {truncateUserId(plant.user_id)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setApprovalTarget(plant);
                      setGrowthDays("");
                      setWateringNeeds("");
                      setErrors({});
                    }}
                    disabled={loading && activePlantId === plant.id}
                  >
                    {loading && activePlantId === plant.id && approvalTarget?.id === plant.id
                      ? pl.admin.approvePending
                      : pl.admin.approve}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setRejectTarget(plant);
                    }}
                    disabled={loading && activePlantId === plant.id}
                  >
                    {loading && activePlantId === plant.id && rejectTarget?.id === plant.id
                      ? pl.admin.rejectPending
                      : pl.admin.reject}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={approvalTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeApprovalDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pl.admin.approveDialogTitle}</DialogTitle>
            <DialogDescription>{pl.admin.approveDialogDescription}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void handleApproveSubmit(event)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{pl.admin.plantNameLabel}</Label>
              <p className="border-border bg-muted/50 rounded-md border px-3 py-2 text-sm">
                {approvalTarget?.name ?? "—"}
              </p>
            </div>

            {errors.general && (
              <p className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                {errors.general[0]}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="growth_days">{pl.admin.growthDaysLabel}</Label>
              <Input
                id="growth_days"
                type="number"
                min="1"
                required
                value={growthDays}
                onChange={(event) => {
                  setGrowthDays(event.target.value);
                }}
                disabled={loading}
              />
              {errors.growth_days && <p className="text-destructive text-sm">{errors.growth_days[0]}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="watering_needs">{pl.admin.wateringNeedsLabel}</Label>
              <Input
                id="watering_needs"
                type="text"
                placeholder={pl.admin.wateringPlaceholder}
                value={wateringNeeds}
                onChange={(event) => {
                  setWateringNeeds(event.target.value);
                }}
                disabled={loading}
              />
              {errors.watering_needs && <p className="text-destructive text-sm">{errors.watering_needs[0]}</p>}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? pl.admin.approvePending : pl.admin.approve}
              </Button>
              <Button type="button" variant="outline" onClick={closeApprovalDialog} disabled={loading}>
                {pl.common.cancel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open && !loading) {
            setRejectTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pl.admin.rejectConfirm}</AlertDialogTitle>
            <AlertDialogDescription>{pl.admin.rejectConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>{pl.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={loading}
              onClick={(event) => {
                event.preventDefault();
                if (rejectTarget) {
                  void handleReject(rejectTarget);
                }
              }}
            >
              {loading ? pl.admin.rejectPending : pl.admin.reject}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
