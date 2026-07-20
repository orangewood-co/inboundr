import type { IOrganization } from "../models/organization.model";

export const FEATURE_KEYS = [
  "rfq",
  "inbox",
  "products",
  "customers",
  "invoices",
  "forms",
  "links",
  "drive",
  "stats",
  "employees",
  "projects",
  "chat",
  "support",
  "assets",
  "service_management",
  "recruitment",
  "workflows",
] as const;
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
  { key: "rfq", label: "Quotations", description: "Gmail inbox ingestion, RFQ workflows, quote drafts, and orders." },
  { key: "inbox", label: "Inbox", description: "Inbound email review, attachments, and RFQ triage." },
  { key: "products", label: "Products", description: "Product catalog, imports, pricing, and SKU management." },
  { key: "customers", label: "Customers", description: "Customer records, imports, contacts, and account history." },
  { key: "invoices", label: "Invoices", description: "Create, send, and manage invoices." },
  { key: "forms", label: "Forms", description: "Published forms, submissions, and exports." },
  { key: "links", label: "Links", description: "Trackable short links and engagement analytics." },
  { key: "drive", label: "Drive", description: "Shared file storage, folders, previews, and secure sharing." },
  { key: "stats", label: "Stats", description: "Operational dashboards, activity metrics, and reporting." },
  { key: "employees", label: "Employees", description: "Employee records, teams, attendance, and platform access." },
  { key: "projects", label: "Projects", description: "Project workspaces, tasks, assignments, and progress tracking." },
  { key: "chat", label: "Chat", description: "AI assistant chat for organization workflows." },
  { key: "support", label: "Support", description: "Support inbox, tickets, templates, and public chat." },
  { key: "assets", label: "Assets", description: "Asset register, depreciation schedules, custody, and disposal tracking." },
  { key: "service_management", label: "Service Management", description: "Service requests, visits, equipment, workflow, and service history." },
  { key: "recruitment", label: "Recruitment", description: "Jobs, candidates, application pipelines, and hiring activity." },
  { key: "workflows", label: "Workflows", description: "Node-based automations on top of the RFQ and Orders flow." },
];

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    slug: "starter",
    name: "Starter",
    description: "Core workflows for smaller teams.",
    features: [...FEATURE_KEYS],
  },
  {
    slug: "growth",
    name: "Growth",
    description: "Sales operations with billing and link tracking.",
    features: [...FEATURE_KEYS],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    description: "Full platform access for production customers.",
    features: [...FEATURE_KEYS],
  },
  {
    slug: "all_features",
    name: "All Features",
    description: "Compatibility plan for existing organizations.",
    features: [...FEATURE_KEYS],
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

export function hasEffectiveFeature(
  organization: Pick<IOrganization, "planSlug" | "enabledFeatures" | "disabledFeatures">,
  feature: FeatureKey
): boolean {
  return isFeatureKey(feature) && getEffectiveFeatures(organization).includes(feature);
}

export function serializeEntitlements(organization: Pick<IOrganization, "planSlug" | "enabledFeatures" | "disabledFeatures">) {
  return {
    planSlug: getPlanDefinition(organization.planSlug).slug,
    enabledFeatures: normalizeFeatures(organization.enabledFeatures),
    disabledFeatures: normalizeFeatures(organization.disabledFeatures),
    effectiveFeatures: getEffectiveFeatures(organization),
  };
}
