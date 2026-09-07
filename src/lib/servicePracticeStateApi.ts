import { supabase } from "./supabase";

export type ServicePracticeState =
  | "active_cleaning_practice"
  | "temporarily_not_taking_cleaning_work"
  | "no_longer_taking_cleaning_work";

export type ServicePracticeStateRow = {
  state: ServicePracticeState;
  changedAt: string;
};

export const SERVICE_PRACTICE_OPTIONS: Array<{
  state: ServicePracticeState;
  label: string;
  description: string;
}> = [
  {
    state: "active_cleaning_practice",
    label: "I currently take cleaning work",
    description: "Residential cleaning is currently part of how you earn or participate.",
  },
  {
    state: "temporarily_not_taking_cleaning_work",
    label: "I’m not taking cleaning work right now",
    description: "A temporary pause. This is separate from availability settings and does not close your Cleanr relationship.",
  },
  {
    state: "no_longer_taking_cleaning_work",
    label: "I no longer take cleaning work",
    description: "Cleaning is no longer part of your current practice, though your role in the Cleanr Continuum can keep evolving.",
  },
];

export async function getMyServicePracticeState(): Promise<ServicePracticeStateRow | null> {
  const { data, error } = await supabase.rpc("get_my_service_practice_state");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    state: String(row.state) as ServicePracticeState,
    changedAt: String(row.changed_at),
  };
}

export async function setMyServicePracticeState(state: ServicePracticeState): Promise<ServicePracticeStateRow> {
  const { data, error } = await supabase.rpc("set_my_service_practice_state", { p_state: state });
  if (error) throw error;
  const row = data as { state?: string; changed_at?: string } | null;
  if (!row?.state || !row.changed_at) throw new Error("service_practice_state_missing");
  return {
    state: row.state as ServicePracticeState,
    changedAt: row.changed_at,
  };
}
