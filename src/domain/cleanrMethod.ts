/**
 * Cleanr Method relationship practices for a residential visit.
 *
 * These are product-owned service principles, not AI orchestration, a friendliness script,
 * or a second cleaning checklist. They help a CSP use existing relationship and household
 * truth with care while leaving operational booking state untouched.
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
      label: "Prepare with context",
      guidance: returning
        ? context.hasRememberedPreferences
          ? "Review what this household chose to remember and what changed for this visit. Familiarity is useful; assumptions are not."
          : "Review this visit before arrival and use prior service history as continuity, not as permission to assume nothing has changed."
        : "Read this visit before arrival. Learn only what helps you serve well, and do not collect personal context you do not need.",
    },
    {
      key: "attune",
      label: "Notice the household",
      guidance: returning
        ? "Respect established preferences while noticing what is different today. A strong relationship stays attentive instead of becoming automatic."
        : "Establish the household's baseline: priorities, boundaries, and how they want the service relationship to work.",
    },
    {
      key: "communicate",
      label: "Communicate before surprises",
      guidance: context.hasVisitSpecificUpdates
        ? "Acknowledge material visit-specific changes before acting. If something is unclear or changes scope, ask early."
        : "If something changes, is unclear, or could affect the result, communicate before it becomes a surprise.",
    },
    {
      key: "close",
      label: "Leave useful continuity",
      guidance: context.memoryEnabled
        ? "Close clearly: what was completed, what genuinely matters next time, and what should remain visit-specific. Do not turn casual conversation into stored memory."
        : "Close clearly: what was completed and anything the household should know. Do not create persistent memory without the household choosing it.",
    },
  ];
}
