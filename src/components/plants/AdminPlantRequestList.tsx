import { useState } from "react";
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
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function truncateUserId(userId: string | null) {
  if (!userId) {
    return "unknown";
  }

  if (userId.length <= 12) {
    return userId;
  }

  return `${userId.slice(0, 8)}...${userId.slice(-4)}`;
}

export default function AdminPlantRequestList({ initialPlants }: Props) {
  const [plants, setPlants] = useState<PlantRow[]>(initialPlants);
  const [approvalTarget, setApprovalTarget] = useState<PlantRow | null>(null);
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
        setErrors({ general: [payload.error ?? "Failed to approve plant request."] });
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
    if (!window.confirm("Remove this plant request?")) {
      return;
    }

    setLoading(true);
    setActivePlantId(plant.id);
    setErrors({});

    const response = await fetch(`/api/admin/plant-requests/${plant.id}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setErrors({ general: [payload.error ?? "Failed to reject plant request."] });
      setLoading(false);
      setActivePlantId(null);
      return;
    }

    setPlants((currentPlants) => currentPlants.filter((currentPlant) => currentPlant.id !== plant.id));
    setLoading(false);
    setActivePlantId(null);
  };

  return (
    <div className="space-y-4">
      {errors.general && !approvalTarget && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{errors.general[0]}</p>
      )}

      {plants.length === 0 ? (
        <p className="text-sm text-slate-500">No pending plant requests.</p>
      ) : (
        <ul className="space-y-3">
          {plants.map((plant) => (
            <li key={plant.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">{plant.name}</p>
                  <p className="text-sm text-slate-500">Created: {formatCreatedAt(plant.created_at)}</p>
                  <p className="text-sm text-slate-500">User: {truncateUserId(plant.user_id)}</p>
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
                    {loading && activePlantId === plant.id ? "Approving..." : "Approve"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      void handleReject(plant);
                    }}
                    disabled={loading && activePlantId === plant.id}
                  >
                    {loading && activePlantId === plant.id ? "Rejecting..." : "Reject"}
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
            <DialogTitle>Approve plant request</DialogTitle>
            <DialogDescription>Set catalog details before publishing this plant globally.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void handleApproveSubmit(event)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Plant name</Label>
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                {approvalTarget?.name ?? "-"}
              </p>
            </div>

            {errors.general && (
              <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {errors.general[0]}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="growth_days">Growth days</Label>
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
              {errors.growth_days && <p className="text-sm text-red-600">{errors.growth_days[0]}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="watering_needs">Watering needs</Label>
              <Input
                id="watering_needs"
                type="text"
                placeholder="low / medium / high"
                value={wateringNeeds}
                onChange={(event) => {
                  setWateringNeeds(event.target.value);
                }}
                disabled={loading}
              />
              {errors.watering_needs && <p className="text-sm text-red-600">{errors.watering_needs[0]}</p>}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Approving..." : "Approve"}
              </Button>
              <Button type="button" variant="outline" onClick={closeApprovalDialog} disabled={loading}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
