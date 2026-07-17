import type { Request, Response } from "express";

import type { OrganizationRequest } from "../middleware/auth.middleware";
import {
  getOrCreateProductSettings,
  normalizeProductAdjustmentDefinitions,
  normalizeProductFieldDefinitions,
} from "../services/product-settings.service";

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown): string[] {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
}

export async function getProductSettings(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const settings = await getOrCreateProductSettings(organization._id);
    res.json({
      ...settings.toObject({ flattenMaps: true }),
      currency: organization.preferences?.pricing || "INR",
    });
  } catch (error) {
    console.error("Error loading product settings:", error);
    res.status(500).json({ error: "Failed to load product settings" });
  }
}

export async function updateProductSettings(req: Request, res: Response): Promise<void> {
  try {
    const organization = (req as OrganizationRequest).organization;
    const settings = await getOrCreateProductSettings(organization._id);
    const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
    const terminology = body.terminology && typeof body.terminology === "object"
      ? body.terminology as Record<string, unknown>
      : {};
    const search = body.search && typeof body.search === "object"
      ? body.search as Record<string, unknown>
      : {};
    const synonymsInput = search.synonyms && typeof search.synonyms === "object" && !Array.isArray(search.synonyms)
      ? search.synonyms as Record<string, unknown>
      : {};
    const synonyms = Object.fromEntries(
      Object.entries(synonymsInput)
        .map(([key, values]) => [key.trim().toLowerCase(), stringList(values)] as const)
        .filter(([key, values]) => key && values.length > 0)
    );

    settings.terminology = {
      singular: stringValue(terminology.singular, settings.terminology.singular),
      plural: stringValue(terminology.plural, settings.terminology.plural),
      skuLabel: stringValue(terminology.skuLabel, settings.terminology.skuLabel),
      manufacturerLabel: stringValue(terminology.manufacturerLabel, settings.terminology.manufacturerLabel),
      taxCodeLabel: stringValue(terminology.taxCodeLabel, settings.terminology.taxCodeLabel),
      taxRateLabel: stringValue(terminology.taxRateLabel, settings.terminology.taxRateLabel),
    };
    if ("fieldDefinitions" in body) {
      settings.fieldDefinitions = normalizeProductFieldDefinitions(body.fieldDefinitions, settings.fieldDefinitions);
    }
    if ("adjustmentDefinitions" in body) {
      settings.adjustmentDefinitions = normalizeProductAdjustmentDefinitions(body.adjustmentDefinitions);
    }
    settings.search = {
      synonyms: search.synonyms !== undefined
        ? synonyms
        : settings.search.synonyms,
      stopWords: search.stopWords !== undefined
        ? stringList(search.stopWords)
        : settings.search.stopWords,
      instructions: search.instructions !== undefined
        ? (typeof search.instructions === "string" ? search.instructions.trim().slice(0, 8000) : "")
        : settings.search.instructions,
      matchThreshold: search.matchThreshold !== undefined && Number.isFinite(Number(search.matchThreshold))
        ? Math.max(0, Number(search.matchThreshold))
        : settings.search.matchThreshold,
      ambiguityGap: search.ambiguityGap !== undefined && Number.isFinite(Number(search.ambiguityGap))
        ? Math.max(0, Number(search.ambiguityGap))
        : settings.search.ambiguityGap,
    };
    await settings.save();
    res.json({
      ...settings.toObject({ flattenMaps: true }),
      currency: organization.preferences?.pricing || "INR",
    });
  } catch (error) {
    const status = typeof (error as { statusCode?: unknown })?.statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : 500;
    if (status === 500) console.error("Error updating product settings:", error);
    res.status(status).json({ error: error instanceof Error ? error.message : "Failed to update product settings" });
  }
}
