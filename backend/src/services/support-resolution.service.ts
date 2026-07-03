import mongoose from "mongoose";

import { Organization } from "../models/organization.model";

export interface SupportResolutionReason {
  id: string;
  label: string;
}

export const RESOLUTION_NOTE_MAX_LENGTH = 2000;

export const DEFAULT_RESOLUTION_REASONS: SupportResolutionReason[] = [
  { id: "issue-fixed", label: "Issue Fixed" },
  { id: "question-answered", label: "Question Answered" },
  { id: "duplicate", label: "Duplicate" },
  { id: "spam-or-abuse", label: "Spam or Abuse" },
  { id: "no-response", label: "No Response from Customer" },
];

/** Returns the org's configured reasons, falling back to the defaults when unset. */
export function getEffectiveResolutionReasons(organization: unknown): SupportResolutionReason[] {
  const configured = (organization as { preferences?: { supportResolutionReasons?: unknown } })
    ?.preferences?.supportResolutionReasons;
  const reasons = Array.isArray(configured)
    ? configured
        .map((reason) => ({
          id: String((reason as { id?: unknown })?.id ?? "").trim(),
          label: String((reason as { label?: unknown })?.label ?? "").trim(),
        }))
        .filter((reason) => reason.id && reason.label)
    : [];
  return reasons.length > 0 ? reasons : DEFAULT_RESOLUTION_REASONS;
}

export async function findResolutionReasonForOrganization(
  organizationId: mongoose.Types.ObjectId | string,
  reasonId: string
): Promise<SupportResolutionReason | null> {
  if (!reasonId || !mongoose.Types.ObjectId.isValid(String(organizationId))) return null;
  const organization = await Organization.findById(organizationId)
    .select("preferences.supportResolutionReasons")
    .lean();
  if (!organization) return null;
  return (
    getEffectiveResolutionReasons(organization).find((reason) => reason.id === reasonId) ?? null
  );
}

export function normalizeResolutionNote(value: unknown): string | null {
  const note = String(value ?? "")
    .trim()
    .slice(0, RESOLUTION_NOTE_MAX_LENGTH);
  return note || null;
}
