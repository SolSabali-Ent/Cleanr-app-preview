export const useJobFlow = (status: string) => {
  const canAdvance = ["scheduled", "in_progress"].includes(status);
  const isComplete = status === "completed";

  return { canAdvance, isComplete };
};
