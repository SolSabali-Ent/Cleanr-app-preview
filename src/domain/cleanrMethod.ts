/**
 * Cleanr Method relationship practices for a residential visit.
 *
 * Internal product logic can stay precise; anything shown to a CSP should use everyday language.
 */

export type CleanrMethodVisitPracticeKey =
  | "prepare"
  | "attune"
  | "communicate"
  | "close";

export interface CleanrMethodVisitPractice {
  key: CleanrMethodVisitPracticeKey;
  label: string;
  guidance: string;
}

export interface CleanrMethodVisitContext {
  completedServicesCount: number;
  memoryEnabled: boolean;
  hasRememberedPreferences: boolean;
  hasVisitSpecificUpdates: boolean;
}

export function buildCleanrMethodVisitPractices(
  context: CleanrMethodVisitContext
): CleanrMethodVisitPractice[] {
  const returning = context.completedServicesCount > 0;

  return [
    {
      key: "prepare",
      label: "Know what matters before you arrive",
      guidance: returning
        ? context.hasRememberedPreferences
          ? "Review the preferences this household chose to save and check what changed for this visit. Knowing the home helps, but do not assume everything is the same."
          : "Review this visit and any past service notes before you arrive. Use them as a guide, and still pay attention to what is different today."
        : "Read the visit details before you arrive. Learn only what helps you do the job well, and do not collect personal information you do not need.",
    },
    {
      key: "attune",
      label: "Pay attention to the home",
      guidance: returning
        ? "Respect the household's known preferences and notice what is different today. Familiarity should make you more attentive, not less."
        : "Learn what matters to this household: their priorities, boundaries, and how they want the visit to go.",
    },
    {
      key: "communicate",
      label: "Speak up early",
      guidance: context.hasVisitSpecificUpdates
        ? "Review any changes for this visit before you begin. If something is unclear or could change the job, ask before moving forward."
        : "If something changes, is unclear, or could affect the result, communicate early instead of letting it become a surprise.",
    },
    {
      key: "close",
      label: "Leave helpful notes for next time",
      guidance: context.memoryEnabled
        ? "Be clear about what you completed and anything that would truly help on the next visit. Do not save personal details just because they came up in conversation."
        : "Be clear about what you completed and anything the household should know. Only save ongoing preferences when the household has chosen to allow it.",
    },
  ];
}
