import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface FormErrors {
  name?: string[];
  cols?: string[];
  rows?: string[];
  general?: string;
}

export default function CreateFieldForm() {
  const [name, setName] = useState("");
  const [cols, setCols] = useState("");
  const [rows, setRows] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          cols: Number(cols),
          rows: Number(rows),
        }),
      });

      const data = (await res.json()) as { id?: string; errors?: FormErrors; error?: string };

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else {
          setErrors({ general: data.error ?? "Something went wrong" });
        }
        return;
      }

      window.location.href = `/dashboard/fields/${data.id ?? ""}`;
    } catch {
      setErrors({ general: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.general && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">{errors.general}</p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Field name</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          placeholder="e.g. Main vegetable bed"
          maxLength={50}
          required
        />
        {errors.name && <p className="text-sm text-red-600">{errors.name[0]}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cols">Columns (width)</Label>
          <Input
            id="cols"
            type="number"
            value={cols}
            onChange={(e) => {
              setCols(e.target.value);
            }}
            min={1}
            max={20}
            required
          />
          {errors.cols && <p className="text-sm text-red-600">{errors.cols[0]}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rows">Rows (height)</Label>
          <Input
            id="rows"
            type="number"
            value={rows}
            onChange={(e) => {
              setRows(e.target.value);
            }}
            min={1}
            max={20}
            required
          />
          {errors.rows && <p className="text-sm text-red-600">{errors.rows[0]}</p>}
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating…" : "Create field"}
      </Button>
    </form>
  );
}
