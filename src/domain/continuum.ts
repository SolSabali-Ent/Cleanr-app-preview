export type ContinuumParticipationKey =
  | "service_provider"
  | "coverage_partner"
  | "collaborator"
  | "mentor"
  | "business_owner"
  | "vendor"
  | "employer"
  | "investor"
  | "advisor"
  | "opportunity_creator";

export type ContinuumParticipationStatus = "active" | "ended";
export type ContinuumParticipationOrigin = "person" | "cleanr" | "kinex" | "admin" | "system";
export type ContinuumEvidenceStatus = "self_declared" | "evidenced";

export interface ContinuumParticipation {
  id: string;
  personId: string;
  key: ContinuumParticipationKey;
  status: ContinuumParticipationStatus;
  origin: ContinuumParticipationOrigin;
  evidenceStatus: ContinuumEvidenceStatus;
  evidenceSourceSystem?: "cleanr" | "kinex" | "admin" | "system" | null;
  provenanceType?: string | null;
  provenanceId?: string | null;
  evidenceNote?: string | null;
  startedAt: string;
  endedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SELF_DECLARABLE_CONTINUUM_PARTICIPATIONS: Array<{
  key: Exclude<ContinuumParticipationKey, "service_provider" | "coverage_partner" | "mentor">;
  label: string;
  description: string;
}> = [
  {
    key: "collaborator",
    label: "Collaborator",
    description: "I am open to building or solving something with other people in the network.",
  },
  {
    key: "business_owner",
    label: "Business owner",
    description: "Running a business is part of how I participate today.",
  },
  {
    key: "vendor",
    label: "Vendor",
    description: "I can provide a product or service that may be useful inside the ecosystem.",
  },
  {
    key: "employer",
    label: "Employer",
    description: "I may be able to create paid work for other people.",
  },
  {
    key: "investor",
    label: "Investor",
    description: "Investing is one way I participate. This is descriptive, not financial suitability data.",
  },
  {
    key: "advisor",
    label: "Advisor",
    description: "I may be able to contribute experience or guidance when it is useful.",
  },
  {
    key: "opportunity_creator",
    label: "Opportunity creator",
    description: "I may be able to create or bring real opportunities into the collective.",
  },
];

export function continuumParticipationLabel(key: ContinuumParticipationKey): string {
  switch (key) {
    case "service_provider": return "Residential service provider";
    case "coverage_partner": return "Trusted coverage partner";
    case "mentor": return "Experience connection";
    case "business_owner": return "Business owner";
    case "opportunity_creator": return "Opportunity creator";
    default: return key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
