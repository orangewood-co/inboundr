import type { IOrganization } from "../models/organization.model";

export const FEATURE_KEYS = ["rfq", "invoices", "links", "forms", "drive"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  description: string;
}

export interface PlanDefinition {
  slug: string;
  name: string;
  description: string;
  features: FeatureKey[];
}

export const FEATURE_CATALOG: FeatureDefinition[] = [
  { key: "rfq", label: "RFQ", description: "AI-assisted quote detection and RFQ workflows." },
  { key: "invoices", label: "Invoices", description: "Create, send, and manage invoices." },
  { key: "links", label: "Links", description: "Trackable short links and engagement analytics." },
  { key: "forms", label: "Forms", description: "Published forms, submissions, and exports." },
  { key: "drive", label: "Drive", description: "Shared file storage, folders, previews, and secure sharing." },
];

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    slug: "starter",
    name: "Starter",
    description: "Core workflows for smaller teams.",
    features: ["rfq", "forms"],
  },
  {
    slug: "growth",
    name: "Growth",
    description: "Sales operations with billing and link tracking.",
    features: ["rfq", "invoices", "links", "forms", "drive"],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    description: "Full platform access for production customers.",
    features: ["rfq", "invoices", "links", "forms", "drive"],
  },
  {
    slug: "all_features",
    name: "All Features",
    description: "Compatibility plan for existing organizations.",
    features: ["rfq", "invoices", "links", "forms", "drive"],
  },
];

export function isFeatureKey(value: string): value is FeatureKey {
  return FEATURE_KEYS.includes(value as FeatureKey);
}

export function normalizeFeatures(values: unknown): FeatureKey[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((value): value is FeatureKey => {
    return typeof value === "string" && isFeatureKey(value);
  }))];
}

export function getPlanDefinition(slug?: string | null): PlanDefinition {
  return (
    PLAN_DEFINITIONS.find((plan) => plan.slug === slug) ??
    PLAN_DEFINITIONS.find((plan) => plan.slug === "all_features")!
  );
}

export function getEffectiveFeatures(organization: Pick<IOrganization, "planSlug" | "enabledFeatures" | "disabledFeatures">): FeatureKey[] {
  const planFeatures = new Set(getPlanDefinition(organization.planSlug).features);
  for (const feature of normalizeFeatures(organization.enabledFeatures)) {
    planFeatures.add(feature);
  }
  for (const feature of normalizeFeatures(organization.disabledFeatures)) {
    planFeatures.delete(feature);
  }
  return FEATURE_KEYS.filter((feature) => planFeatures.has(feature));
}

export function serializeEntitlements(organization: Pick<IOrganization, "planSlug" | "enabledFeatures" | "disabledFeatures">) {
  return {
    planSlug: getPlanDefinition(organization.planSlug).slug,
    enabledFeatures: normalizeFeatures(organization.enabledFeatures),
    disabledFeatures: normalizeFeatures(organization.disabledFeatures),
    effectiveFeatures: getEffectiveFeatures(organization),
  };
}
