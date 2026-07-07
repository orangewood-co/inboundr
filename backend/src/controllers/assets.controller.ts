import type { Request, Response } from "express";
import mongoose from "mongoose";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import {
  AssetCategory,
  ASSET_DEPRECIATION_METHODS,
  type AssetDepreciationMethod,
} from "../models/asset-category.model";
import { AssetLocation } from "../models/asset-location.model";
import { AssetActivity } from "../models/asset-activity.model";
import { Asset } from "../models/asset.model";
import {
  activateAsset,
  addAssetAttachment,
  addAssetImages,
  addAssetRepair,
  adjustAssetValue,
  assignAsset,
  AssetServiceError,
  assetBookValueAsOf,
  createAssetRecords,
  deleteAssetRecord,
  depreciationDefaultsFromCategory,
  disposeAsset,
  findAssetOrThrow,
  getAssetSettings,
  getAssetStats,
  getDepreciationRegister,
  listAssetRecords,
  moveAsset,
  normalizeAssetInput,
  removeAssetAttachment,
  removeAssetImage,
  setAssetCondition,
  setAssetCoverImage,
  updateAssetRecord,
  updateAssetSettings,
  type AssetActor,
} from "../services/asset.service";

function organizationIdOf(req: Request) {
  return (req as OrganizationRequest).organization._id;
}

function actorOf(req: Request): AssetActor {
  const orgReq = req as OrganizationRequest;
  return {
    userId: orgReq.user?.id ?? null,
    name: orgReq.user?.name ?? "",
    email: orgReq.user?.email ?? null,
  };
}

function handleError(res: Response, err: unknown, fallback: string): void {
  if (err instanceof AssetServiceError) {
    const status =
      err.code === "not_found" ? 404 : err.code === "invalid_state" ? 409 : 400;
    res.status(status).json({ error: err.message });
    return;
  }
  console.error(fallback, err);
  res.status(500).json({ error: fallback });
}

function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = parseInt(String(value ?? ""), 10);
  const normalized = Number.isFinite(parsed) ? Math.max(1, parsed) : fallback;
  return max ? Math.min(max, normalized) : normalized;
}

function parseAsOfDate(value: unknown): Date {
  if (!value) return new Date();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    const settings = await getAssetSettings(organizationIdOf(req));
    res.json({
      codePrefix: settings.codePrefix,
      nextSequence: settings.nextSequence,
    });
  } catch (err) {
    handleError(res, err, "Failed to fetch asset settings");
  }
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    const settings = await updateAssetSettings(organizationIdOf(req), req.body ?? {});
    res.json({
      codePrefix: settings.codePrefix,
      nextSequence: settings.nextSequence,
    });
  } catch (err) {
    handleError(res, err, "Failed to update asset settings");
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function normalizeCategoryInput(body: Record<string, unknown>) {
  const method = String(body.depreciationMethod ?? "").trim() as AssetDepreciationMethod;
  return {
    name: String(body.name ?? "").trim(),
    description: String(body.description ?? "").trim(),
    depreciationMethod: ASSET_DEPRECIATION_METHODS.includes(method)
      ? method
      : ("straight_line" as AssetDepreciationMethod),
    usefulLifeMonths: parsePositiveInt(body.usefulLifeMonths, 60, 1200),
    salvagePercentage: Math.min(95, Math.max(0, Number(body.salvagePercentage) || 0)),
    wdvRatePercentage: Math.min(100, Math.max(0, Number(body.wdvRatePercentage) || 0)),
  };
}

export async function listCategories(req: Request, res: Response): Promise<void> {
  try {
    const categories = await AssetCategory.find({
      organizationId: organizationIdOf(req),
      status: "active",
    })
      .sort({ name: 1 })
      .lean();
    res.json({ categories });
  } catch (err) {
    handleError(res, err, "Failed to fetch asset categories");
  }
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  try {
    const input = normalizeCategoryInput(req.body ?? {});
    if (!input.name) {
      res.status(400).json({ error: "Category name is required" });
      return;
    }

    const category = await AssetCategory.create({
      organizationId: organizationIdOf(req),
      ...input,
    });
    res.status(201).json(category);
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(400).json({ error: "A category with this name already exists" });
      return;
    }
    handleError(res, err, "Failed to create asset category");
  }
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const input = normalizeCategoryInput(req.body ?? {});
    if (!input.name) {
      res.status(400).json({ error: "Category name is required" });
      return;
    }

    const category = await AssetCategory.findOneAndUpdate(
      { _id: req.params.id, organizationId: organizationIdOf(req) },
      { $set: input },
      { new: true }
    );
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(category);
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(400).json({ error: "A category with this name already exists" });
      return;
    }
    handleError(res, err, "Failed to update asset category");
  }
}

export async function archiveCategory(req: Request, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const category = await AssetCategory.findOneAndUpdate(
      { _id: req.params.id, organizationId: organizationIdOf(req) },
      { $set: { status: "archived" } },
      { new: true }
    );
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.json(category);
  } catch (err) {
    handleError(res, err, "Failed to archive asset category");
  }
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export async function listLocations(req: Request, res: Response): Promise<void> {
  try {
    const locations = await AssetLocation.find({
      organizationId: organizationIdOf(req),
      status: "active",
    })
      .sort({ name: 1 })
      .lean();
    res.json({ locations });
  } catch (err) {
    handleError(res, err, "Failed to fetch asset locations");
  }
}

export async function createLocation(req: Request, res: Response): Promise<void> {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Location name is required" });
      return;
    }

    const location = await AssetLocation.create({
      organizationId: organizationIdOf(req),
      name,
      address: String(req.body?.address ?? "").trim(),
      notes: String(req.body?.notes ?? "").trim(),
    });
    res.status(201).json(location);
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(400).json({ error: "A location with this name already exists" });
      return;
    }
    handleError(res, err, "Failed to create asset location");
  }
}

export async function updateLocation(req: Request, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "Location name is required" });
      return;
    }

    const location = await AssetLocation.findOneAndUpdate(
      { _id: req.params.id, organizationId: organizationIdOf(req) },
      {
        $set: {
          name,
          address: String(req.body?.address ?? "").trim(),
          notes: String(req.body?.notes ?? "").trim(),
        },
      },
      { new: true }
    );
    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }
    res.json(location);
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(400).json({ error: "A location with this name already exists" });
      return;
    }
    handleError(res, err, "Failed to update asset location");
  }
}

export async function archiveLocation(req: Request, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      res.status(404).json({ error: "Location not found" });
      return;
    }

    const location = await AssetLocation.findOneAndUpdate(
      { _id: req.params.id, organizationId: organizationIdOf(req) },
      { $set: { status: "archived" } },
      { new: true }
    );
    if (!location) {
      res.status(404).json({ error: "Location not found" });
      return;
    }
    res.json(location);
  } catch (err) {
    handleError(res, err, "Failed to archive asset location");
  }
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export async function listAssets(req: Request, res: Response): Promise<void> {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const { assets, total } = await listAssetRecords(organizationIdOf(req), {
      page,
      limit,
      search: String(req.query.search ?? "").trim(),
      categoryId: String(req.query.categoryId ?? "").trim(),
      locationId: String(req.query.locationId ?? "").trim(),
      employeeId: String(req.query.employeeId ?? "").trim(),
      lifecycleStatus: String(req.query.lifecycleStatus ?? "").trim(),
      condition: String(req.query.condition ?? "").trim(),
    });

    res.json({
      assets,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    handleError(res, err, "Failed to fetch assets");
  }
}

export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    res.json(await getAssetStats(organizationIdOf(req)));
  } catch (err) {
    handleError(res, err, "Failed to fetch asset stats");
  }
}

export async function getAsset(req: Request, res: Response): Promise<void> {
  try {
    const organizationId = organizationIdOf(req);
    const asset = await findAssetOrThrow(organizationId, String(req.params.id));
    await asset.populate([
      { path: "categoryId", select: "name depreciationMethod usefulLifeMonths salvagePercentage wdvRatePercentage" },
      { path: "locationId", select: "name address" },
      { path: "assignedEmployeeId", select: "fullName email title" },
    ]);

    const activity = await AssetActivity.find({
      organizationId,
      assetId: asset._id,
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({
      asset: {
        ...asset.toObject(),
        currentBookValue:
          asset.lifecycleStatus === "draft"
            ? asset.purchaseCost
            : assetBookValueAsOf(asset, new Date()),
      },
      activity,
    });
  } catch (err) {
    handleError(res, err, "Failed to fetch asset");
  }
}

export async function createAsset(req: Request, res: Response): Promise<void> {
  try {
    const assets = await createAssetRecords(
      organizationIdOf(req),
      req.body ?? {},
      actorOf(req)
    );
    res.status(201).json({ assets, created: assets.length });
  } catch (err) {
    handleError(res, err, "Failed to create asset");
  }
}

export async function updateAsset(req: Request, res: Response): Promise<void> {
  try {
    const asset = await updateAssetRecord(
      organizationIdOf(req),
      String(req.params.id),
      req.body ?? {},
      actorOf(req)
    );
    res.json(asset);
  } catch (err) {
    handleError(res, err, "Failed to update asset");
  }
}

export async function deleteAsset(req: Request, res: Response): Promise<void> {
  try {
    await deleteAssetRecord(organizationIdOf(req), String(req.params.id));
    res.json({ success: true });
  } catch (err) {
    handleError(res, err, "Failed to delete asset");
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type AssetAction = (
  organizationId: mongoose.Types.ObjectId,
  assetId: string,
  body: Record<string, unknown>,
  actor: AssetActor
) => Promise<unknown>;

function actionHandler(action: AssetAction, fallback: string) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const asset = await action(
        organizationIdOf(req),
        String(req.params.id),
        req.body ?? {},
        actorOf(req)
      );
      res.json(asset);
    } catch (err) {
      handleError(res, err, fallback);
    }
  };
}

export const activateAssetHandler = actionHandler(
  (organizationId, assetId, _body, actor) => activateAsset(organizationId, assetId, actor),
  "Failed to activate asset"
);
export const assignAssetHandler = actionHandler(assignAsset, "Failed to assign asset");
export const moveAssetHandler = actionHandler(moveAsset, "Failed to move asset");
export const setConditionHandler = actionHandler(
  setAssetCondition,
  "Failed to update asset condition"
);
export const adjustValueHandler = actionHandler(
  adjustAssetValue,
  "Failed to adjust asset value"
);
export const disposeAssetHandler = actionHandler(disposeAsset, "Failed to dispose asset");
export const addRepairHandler = actionHandler(addAssetRepair, "Failed to log repair");

export async function addAttachment(req: Request, res: Response): Promise<void> {
  try {
    const asset = await addAssetAttachment(
      organizationIdOf(req),
      String(req.params.id),
      req.body ?? {}
    );
    res.json(asset);
  } catch (err) {
    handleError(res, err, "Failed to add attachment");
  }
}

export async function removeAttachment(req: Request, res: Response): Promise<void> {
  try {
    const asset = await removeAssetAttachment(
      organizationIdOf(req),
      String(req.params.id),
      String(req.params.attachmentId)
    );
    res.json(asset);
  } catch (err) {
    handleError(res, err, "Failed to remove attachment");
  }
}

export async function addImages(req: Request, res: Response): Promise<void> {
  try {
    const asset = await addAssetImages(
      organizationIdOf(req),
      String(req.params.id),
      req.body ?? {},
      actorOf(req)
    );
    res.json(asset);
  } catch (err) {
    handleError(res, err, "Failed to add photos");
  }
}

export async function removeImage(req: Request, res: Response): Promise<void> {
  try {
    const asset = await removeAssetImage(
      organizationIdOf(req),
      String(req.params.id),
      String(req.params.imageId),
      actorOf(req)
    );
    res.json(asset);
  } catch (err) {
    handleError(res, err, "Failed to remove photo");
  }
}

export async function setCoverImage(req: Request, res: Response): Promise<void> {
  try {
    const asset = await setAssetCoverImage(
      organizationIdOf(req),
      String(req.params.id),
      String(req.params.imageId),
      actorOf(req)
    );
    res.json(asset);
  } catch (err) {
    handleError(res, err, "Failed to set cover photo");
  }
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

type AssetImportResult = {
  summary: { created: number; skipped: number; failed: number; total: number };
  errors: Array<{ row: number; error: string }>;
  skipped: Array<{ row: number; assetCode: string; reason: string }>;
};

export async function importAssets(req: Request, res: Response): Promise<void> {
  try {
    const organizationId = organizationIdOf(req);
    const actor = actorOf(req);
    const rows = Array.isArray(req.body?.assets) ? req.body.assets : [];

    if (rows.length === 0) {
      res.status(400).json({ error: "No assets provided for import" });
      return;
    }
    if (rows.length > 1000) {
      res.status(400).json({ error: "Import is limited to 1000 rows at a time" });
      return;
    }

    const [categories, locations] = await Promise.all([
      AssetCategory.find({ organizationId, status: "active" }).lean(),
      AssetLocation.find({ organizationId, status: "active" }).lean(),
    ]);
    const categoriesByName = new Map(
      categories.map((category) => [category.name.toLowerCase(), category])
    );
    const locationsByName = new Map(
      locations.map((location) => [location.name.toLowerCase(), location])
    );

    const result: AssetImportResult = {
      summary: { created: 0, skipped: 0, failed: 0, total: rows.length },
      errors: [],
      skipped: [],
    };

    for (const [index, rawRow] of rows.entries()) {
      const rowNumber = index + 2;
      try {
        if (!rawRow || typeof rawRow !== "object" || Array.isArray(rawRow)) {
          throw new Error("Row is not a valid asset");
        }

        const row = rawRow as Record<string, unknown>;
        const explicitCode = String(row.assetCode ?? "").trim();
        if (explicitCode) {
          const existing = await Asset.exists({ organizationId, assetCode: explicitCode });
          if (existing) {
            result.summary.skipped += 1;
            result.skipped.push({
              row: rowNumber,
              assetCode: explicitCode,
              reason: "Asset code already exists",
            });
            continue;
          }
        }

        const categoryName = String(row.category ?? "").trim().toLowerCase();
        const locationName = String(row.location ?? "").trim().toLowerCase();
        const category = categoryName ? categoriesByName.get(categoryName) ?? null : null;
        if (categoryName && !category) {
          throw new Error(`Unknown category "${String(row.category)}"`);
        }
        const location = locationName ? locationsByName.get(locationName) ?? null : null;
        if (locationName && !location) {
          throw new Error(`Unknown location "${String(row.location)}"`);
        }

        const body: Record<string, unknown> = {
          ...row,
          categoryId: category ? String(category._id) : undefined,
          locationId: location ? String(location._id) : undefined,
          copies: 1,
        };
        if (!body.depreciation) {
          const depreciation: Record<string, unknown> = {};
          for (const field of [
            "method",
            "usefulLifeMonths",
            "salvagePercentage",
            "wdvRatePercentage",
            "openingAccumulatedDepreciation",
          ]) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== "") {
              depreciation[field] = row[field];
            }
          }
          if (Object.keys(depreciation).length > 0) body.depreciation = depreciation;
        }

        const [asset] = await createAssetRecords(organizationId, body, actor);

        if (explicitCode && asset) {
          asset.assetCode = explicitCode;
          await asset.save();
        }
        if (asset && String(row.status ?? "").trim().toLowerCase() === "active") {
          await activateAsset(organizationId, String(asset._id), actor);
        }

        result.summary.created += 1;
      } catch (err) {
        result.summary.failed += 1;
        result.errors.push({
          row: rowNumber,
          error: err instanceof Error ? err.message : "Unable to import row",
        });
      }
    }

    res.json(result);
  } catch (err) {
    handleError(res, err, "Failed to import assets");
  }
}

// ---------------------------------------------------------------------------
// Depreciation register report
// ---------------------------------------------------------------------------

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function depreciationRegister(req: Request, res: Response): Promise<void> {
  try {
    const asOf = parseAsOfDate(req.query.asOf);
    const rows = await getDepreciationRegister(organizationIdOf(req), asOf);

    if (String(req.query.format ?? "") === "csv") {
      const header = [
        "Asset Code",
        "Name",
        "Category",
        "Status",
        "Purchase Date",
        "Purchase Cost",
        "Accumulated Depreciation",
        "Book Value",
        "Disposal Type",
        "Disposal Date",
      ];
      const lines = [
        header.join(","),
        ...rows.map((row) =>
          [
            row.assetCode,
            row.name,
            row.categoryName,
            row.lifecycleStatus,
            row.purchaseDate ? row.purchaseDate.toISOString().slice(0, 10) : "",
            row.purchaseCost.toFixed(2),
            row.accumulatedDepreciation.toFixed(2),
            row.bookValue.toFixed(2),
            row.disposalType ?? "",
            row.disposalDate ? row.disposalDate.toISOString().slice(0, 10) : "",
          ]
            .map(csvEscape)
            .join(",")
        ),
      ];

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="depreciation-register-${asOf.toISOString().slice(0, 10)}.csv"`
      );
      res.send(lines.join("\n"));
      return;
    }

    res.json({ asOf: asOf.toISOString(), rows });
  } catch (err) {
    handleError(res, err, "Failed to build depreciation register");
  }
}

// ---------------------------------------------------------------------------
// Category depreciation defaults helper (used by the create form)
// ---------------------------------------------------------------------------

export async function getCategoryDefaults(req: Request, res: Response): Promise<void> {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    const category = await AssetCategory.findOne({
      _id: req.params.id,
      organizationId: organizationIdOf(req),
    }).lean();
    if (!category) {
      res.status(404).json({ error: "Category not found" });
      return;
    }

    res.json(depreciationDefaultsFromCategory(category));
  } catch (err) {
    handleError(res, err, "Failed to fetch category defaults");
  }
}
