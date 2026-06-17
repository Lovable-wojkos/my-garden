import { useState } from "react";
import type { PlantRow } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { pl } from "@/lib/copy/pl";

interface Props {
  initialPending: PlantRow[];
}

export default function PlantRequestForm({ initialPending }: Props) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(initialPending);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmed = name.trim();
    if (!trimmed) {
      setError(pl.plantRequests.errors.nameRequired);
      return;
    }
    if (trimmed.length < 2) {
      setError(pl.plantRequests.errors.nameMinLength);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/plant-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (res.status === 401) {
        window.location.href = "/auth/signin";
        return;
      }

      if (!res.ok) {
        setError(pl.plantRequests.errors.submitFailed);
        return;
      }

      const plant = (await res.json()) as PlantRow;
      setPending((prev) => [plant, ...prev]);
      setName("");
      setSuccess(true);
    } catch {
      setError(pl.plantRequests.errors.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="border-border bg-card space-y-4 rounded-xl border p-6 shadow-sm"
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="plant-name">{pl.plantRequests.formLabel}</Label>
          <Input
            id="plant-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
              setSuccess(false);
            }}
            placeholder={pl.plantRequests.formPlaceholder}
            disabled={submitting}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          {success && <p className="text-primary text-sm">{pl.plantRequests.success}</p>}
        </div>
        <Button type="submit" disabled={submitting} className="min-h-11">
          {submitting ? pl.plantRequests.submitPending : pl.plantRequests.submit}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-foreground text-lg font-semibold">{pl.plantRequests.pendingHeading}</h2>
        {pending.length > 0 ? (
          <ul className="space-y-2">
            {pending.map((plant) => (
              <li
                key={plant.id}
                className="border-border bg-card flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm"
              >
                <span className="text-foreground font-medium">{plant.name}</span>
                <span className="text-muted-foreground text-sm">{pl.plantRequests.statusPending}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{pl.plantRequests.empty}</p>
        )}
      </section>
    </div>
  );
}
