import type { SupabaseClient } from "@supabase/supabase-js";
import type { WateringEventInsert, WateringEventRow } from "@/types";

export async function createWateringEvent(client: SupabaseClient, insert: WateringEventInsert) {
  return client.from("watering_events").insert(insert).select().single<WateringEventRow>();
}

export async function getWateringEventsInWindow(
  client: SupabaseClient,
  userId: string,
  windowDates: string[],
): Promise<{ data: WateringEventRow[] | null; error: unknown }> {
  if (windowDates.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await client
    .from("watering_events")
    .select("*")
    .eq("user_id", userId)
    .in("watered_at", windowDates)
    .overrideTypes<WateringEventRow[], { merge: false }>();

  return { data, error };
}

export function aggregateWateringEventsMm(rows: WateringEventRow[], fieldId: string): number {
  if (rows.length === 0) return 0;

  return rows.reduce((sum, row) => {
    if (row.field_id === fieldId || row.field_id === null) {
      return sum + Number(row.amount_mm);
    }
    return sum;
  }, 0);
}

export function sumAllWateringEventsMm(rows: WateringEventRow[]): number {
  return rows.reduce((sum, row) => sum + Number(row.amount_mm), 0);
}
