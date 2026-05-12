import type { Request, Response } from "express";
import type { OrganizationRequest } from "../middleware/auth.middleware";

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeOrganizationInput(body: Record<string, unknown>) {
  const defaultContact = body.defaultContact as Record<string, unknown> | undefined;
  const preferences = body.preferences as Record<string, unknown> | undefined;

  return {
    ...(body.name !== undefined ? { name: stringValue(body.name) } : {}),
    ...(body.website !== undefined ? { website: stringValue(body.website) } : {}),
    ...(body.logoUrl !== undefined ? { logoUrl: stringValue(body.logoUrl) } : {}),
    ...(body.address !== undefined ? { address: stringValue(body.address) } : {}),
    ...(defaultContact
      ? {
          defaultContact: {
            name: stringValue(defaultContact.name),
            email: stringValue(defaultContact.email).toLowerCase(),
            phoneNumber: stringValue(defaultContact.phoneNumber),
          },
        }
      : {}),
    ...(preferences
      ? {
          preferences: {
            primaryColor: stringValue(preferences.primaryColor) || "#f5b400",
            theme: preferences.theme === "light" ? "light" : "dark",
            pricing: stringValue(preferences.pricing) || "INR",
            defaultTerms: stringValue(preferences.defaultTerms),
          },
        }
      : {}),
  };
}

export async function getMyOrganization(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    res.json({ organization });
  } catch (err) {
    console.error("Error fetching organization:", err);
    res.status(500).json({ error: "Failed to fetch organization" });
  }
}

export async function updateMyOrganization(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const input = normalizeOrganizationInput(req.body ?? {});

    if ("name" in input && !input.name) {
      res.status(400).json({ error: "Organization name is required" });
      return;
    }

    organization.set(input);
    await organization.save();
    res.json({ organization });
  } catch (err) {
    console.error("Error updating organization:", err);
    res.status(500).json({ error: "Failed to update organization" });
  }
}
