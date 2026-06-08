import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FieldGrid from "@/components/fields/FieldGrid";
import type { FieldRow, PlantingRow, PlantRow } from "@/types";

const mockField: FieldRow = {
  id: "field-1",
  user_id: "user-1",
  name: "Test Field",
  cols: 3,
  rows: 2,
  region_id: "region-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockPlants: PlantRow[] = [
  {
    id: "plant-1",
    name: "Tomato",
    growth_days: 70,
    watering_needs: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const mockPlanting: PlantingRow = {
  id: "planting-1",
  field_id: "field-1",
  user_id: "user-1",
  plant_id: "plant-1",
  plant_name: "Tomato",
  cell_row: 0,
  cell_col: 0,
  seeding_date: "2026-05-01",
  notes: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

describe("FieldGrid", () => {
  it("renders the correct number of cells (rows × cols)", () => {
    render(<FieldGrid field={mockField} plantings={[]} plants={[]} />);
    // 3 cols × 2 rows = 6 cells, each is a clickable button
    const cells = screen.getAllByRole("button");
    expect(cells).toHaveLength(6);
  });

  it("shows 'Empty' for unplanted cells", () => {
    render(<FieldGrid field={mockField} plantings={[]} plants={[]} />);
    const emptyCells = screen.getAllByText(/empty/i);
    expect(emptyCells).toHaveLength(6);
  });

  it("shows plant name for a planted cell", () => {
    render(<FieldGrid field={mockField} plantings={[mockPlanting]} plants={mockPlants} />);
    expect(screen.getByText("Tomato")).toBeInTheDocument();
  });

  it("shows seeding date for a planted cell", () => {
    render(<FieldGrid field={mockField} plantings={[mockPlanting]} plants={mockPlants} />);
    expect(screen.getByText("2026-05-01")).toBeInTheDocument();
  });

  it("marks remaining cells as empty when only one cell is planted", () => {
    render(<FieldGrid field={mockField} plantings={[mockPlanting]} plants={mockPlants} />);
    // 1 planted, 5 empty
    const emptyCells = screen.getAllByText(/empty/i);
    expect(emptyCells).toHaveLength(5);
  });
});
