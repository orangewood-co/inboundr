import crypto from "crypto";
import mongoose, { type Types } from "mongoose";
import {
  Asset,
  ASSET_CONDITIONS,
  ASSET_LIFECYCLE_STATUSES,
  type AssetCondition,
  type AssetDisposalType,
  type AssetLifecycleStatus,
  type IAsset,
  type IAssetDepreciationParams,
} from "../models/asset.model";
import {
  AssetCategory,
  ASSET_DEPRECIATION_METHODS,
  type AssetDepreciationMethod,
  type IAssetCategory,
} from "../models/asset-category.model";
import { AssetLocation } from "../models/asset-location.model";
import {
  AssetActivity,
  type AssetActivityType,
} from "../models/asset-activity.model";
import {
  AssetSettings,
  DEFAULT_ASSET_CODE_PREFIX,
  type IAssetSettings,
} from "../models/asset-settings.model";
import { Employee } from "../models/employee.model";
import {
  applyValueAdjustment,
  bookValueAsOf,
  generateSchedule,
  toUtcDay,
} from "./asset-depreciation.service";

export type AssetServiceErrorCode =
  | "validation"
  | "not_found"
  | "invalid_state";

export class AssetServiceError extends Error {
  readonly code: AssetServiceErrorCode;

  constructor(code: AssetServiceErrorCode, message: string) {
    super(message);
    this.name = "AssetServiceError";
    this.code = code;
  }
}

export interface AssetActor {
  userId: string | null;
  name: string;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function objectIdOrNull(value: unknown): Types.ObjectId | null {
  const raw = stringValue(value);
  if (!raw) return null;
  return mongoose.Types.ObjectId.isValid(raw)
    ? new mongoose.Types.ObjectId(raw)
    : null;
}

// ---------------------------------------------------------------------------
// Settings & code generation
// ---------------------------------------------------------------------------

export async function getAssetSettings(
  organizationId: Types.ObjectId
): Promise<IAssetSettings> {
  return AssetSettings.findOneAndUpdate(
    { organizationId },
    { $setOnInsert: { codePrefix: DEFAULT_ASSET_CODE_PREFIX, nextSequence: 1 } },
    { new: true, upsert: true }
  );
}

export async function updateAssetSettings(
  organizationId: Types.ObjectId,
  body: Record<string, unknown>
): Promise<IAssetSettings> {
  const codePrefix = stringValue(body.codePrefix).toUpperCase();
  if (!/^[A-Z0-9]{1,8}$/.test(codePrefix)) {
    throw new AssetServiceError(
      "validation",
      "Code prefix must be 1-8 letters or digits"
    );
  }

  return AssetSettings.findOneAndUpdate(
    { organizationId },
    { $set: { codePrefix } },
    { new: true, upsert: true }
  );
}

async function nextAssetCodes(
  organizationId: Types.ObjectId,
  count: number
): Promise<string[]> {
  const settings = await AssetSettings.findOneAndUpdate(
    { organizationId },
    {
      $inc: { nextSequence: count },
      $setOnInsert: { codePrefix: DEFAULT_ASSET_CODE_PREFIX },
    },
    { new: true, upsert: true }
  );

  const firstSequence = settings.nextSequence - count;
  return Array.from({ length: count }, (_, index) =>
    `${settings.codePrefix}-${String(firstSequence + index).padStart(4, "0")}`
  );
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export async function logAssetActivity(input: {
  organizationId: Types.ObjectId;
  assetId: Types.ObjectId;
  type: AssetActivityType;
  actor: AssetActor;
  message: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await AssetActivity.create({
    organizationId: input.organizationId,
    assetId: input.assetId,
    type: input.type,
    actorUserId: input.actor.userId,
    actorName: input.actor.name,
    message: input.message,
    payload: input.payload ?? {},
  });
}

// ---------------------------------------------------------------------------
// Depreciation helpers
// ---------------------------------------------------------------------------

function depreciationStartDate(asset: Pick<IAsset, "availableForUseDate" | "purchaseDate">): Date | null {
  return asset.availableForUseDate ?? asset.purchaseDate;
}

function scheduleParamsFor(asset: IAsset) {
  const start = depreciationStartDate(asset);
  if (!start) {
    throw new AssetServiceError(
      "validation",
      "A purchase date or available-for-use date is required to generate depreciation"
    );
  }

  return {
    purchaseCost: asset.purchaseCost,
    availableForUseDate: start,
    method: asset.depreciation.method,
    usefulLifeMonths: asset.depreciation.usefulLifeMonths,
    salvagePercentage: asset.depreciation.salvagePercentage,
    wdvRatePercentage: asset.depreciation.wdvRatePercentage,
    openingAccumulatedDepreciation:
      asset.depreciation.openingAccumulatedDepreciation,
  };
}

export function regenerateAssetSchedule(asset: IAsset): void {
  asset.depreciationSchedule = generateSchedule(scheduleParamsFor(asset)) as IAsset["depreciationSchedule"];
}

export function assetBookValueAsOf(
  asset: Pick<IAsset, "purchaseCost" | "depreciation" | "depreciationSchedule" | "lifecycleStatus" | "disposal">,
  asOf: Date
): number {
  const effectiveDate =
    asset.disposal && toUtcDay(asset.disposal.date) < toUtcDay(asOf)
      ? asset.disposal.date
      : asOf;

  return bookValueAsOf(
    {
      purchaseCost: asset.purchaseCost,
      openingAccumulatedDepreciation:
        asset.depreciation.openingAccumulatedDepreciation,
      depreciationSchedule: asset.depreciationSchedule,
    },
    effectiveDate
  );
}

// ---------------------------------------------------------------------------
// Input normalization
// ---------------------------------------------------------------------------

export interface AssetInput {
  name?: string;
  serialNumber?: string;
  description?: string;
  categoryId?: Types.ObjectId | null;
  purchaseDate?: Date | null;
  purchaseCost?: number;
  vendorName?: string;
  invoiceReference?: string;
  availableForUseDate?: Date | null;
  locationId?: Types.ObjectId | null;
  assignedEmployeeId?: Types.ObjectId | null;
  condition?: AssetCondition;
  warrantyExpiryDate?: Date | null;
  amcExpiryDate?: Date | null;
  depreciation?: Partial<IAssetDepreciationParams>;
}

export function normalizeAssetInput(body: Record<string, unknown>): AssetInput {
  const input: AssetInput = {};

  if ("name" in body) input.name = stringValue(body.name);
  if ("serialNumber" in body) input.serialNumber = stringValue(body.serialNumber);
  if ("description" in body) input.description = stringValue(body.description);
  if ("categoryId" in body) input.categoryId = objectIdOrNull(body.categoryId);
  if ("purchaseDate" in body) input.purchaseDate = parseDate(body.purchaseDate);
  if ("purchaseCost" in body) input.purchaseCost = Math.max(0, parseNumber(body.purchaseCost));
  if ("vendorName" in body) input.vendorName = stringValue(body.vendorName);
  if ("invoiceReference" in body) input.invoiceReference = stringValue(body.invoiceReference);
  if ("availableForUseDate" in body) input.availableForUseDate = parseDate(body.availableForUseDate);
  if ("locationId" in body) input.locationId = objectIdOrNull(body.locationId);
  if ("assignedEmployeeId" in body) input.assignedEmployeeId = objectIdOrNull(body.assignedEmployeeId);
  if ("warrantyExpiryDate" in body) input.warrantyExpiryDate = parseDate(body.warrantyExpiryDate);
  if ("amcExpiryDate" in body) input.amcExpiryDate = parseDate(body.amcExpiryDate);

  if ("condition" in body) {
    const condition = stringValue(body.condition) as AssetCondition;
    if (ASSET_CONDITIONS.includes(condition)) input.condition = condition;
  }

  const rawDepreciation = body.depreciation;
  if (rawDepreciation && typeof rawDepreciation === "object" && !Array.isArray(rawDepreciation)) {
    const dep = rawDepreciation as Record<string, unknown>;
    const depreciation: Partial<IAssetDepreciationParams> = {};
    if ("method" in dep) {
      const method = stringValue(dep.method) as AssetDepreciationMethod;
      if (ASSET_DEPRECIATION_METHODS.includes(method)) depreciation.method = method;
    }
    if ("usefulLifeMonths" in dep) {
      depreciation.usefulLifeMonths = Math.max(1, Math.round(parseNumber(dep.usefulLifeMonths, 60)));
    }
    if ("salvagePercentage" in dep) {
      depreciation.salvagePercentage = Math.min(95, Math.max(0, parseNumber(dep.salvagePercentage)));
    }
    if ("wdvRatePercentage" in dep) {
      depreciation.wdvRatePercentage = Math.min(100, Math.max(0, parseNumber(dep.wdvRatePercentage)));
    }
    if ("openingAccumulatedDepreciation" in dep) {
      depreciation.openingAccumulatedDepreciation = Math.max(0, parseNumber(dep.openingAccumulatedDepreciation));
    }
    input.depreciation = depreciation;
  }

  return input;
}

export function depreciationDefaultsFromCategory(
  category: Pick<IAssetCategory, "depreciationMethod" | "usefulLifeMonths" | "salvagePercentage" | "wdvRatePercentage"> | null
): IAssetDepreciationParams {
  return {
    method: category?.depreciationMethod ?? "straight_line",
    usefulLifeMonths: category?.usefulLifeMonths ?? 60,
    salvagePercentage: category?.salvagePercentage ?? 0,
    wdvRatePercentage: category?.wdvRatePercentage ?? 0,
    openingAccumulatedDepreciation: 0,
  };
}

async function validateReferences(
  organizationId: Types.ObjectId,
  input: AssetInput
): Promise<void> {
  if (input.categoryId) {
    const category = await AssetCategory.exists({ _id: input.categoryId, organizationId });
    if (!category) throw new AssetServiceError("validation", "Asset category not found");
  }
  if (input.locationId) {
    const location = await AssetLocation.exists({ _id: input.locationId, organizationId });
    if (!location) throw new AssetServiceError("validation", "Asset location not found");
  }
  if (input.assignedEmployeeId) {
    const employee = await Employee.exists({ _id: input.assignedEmployeeId, organizationId });
    if (!employee) throw new AssetServiceError("validation", "Employee not found");
  }
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export const MAX_ASSET_IMAGES = 8;

interface AssetImageInput {
  key: string;
  originalName: string;
  contentType: string;
  size: number;
}

function normalizeImageInputs(value: unknown): AssetImageInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) => ({
      key: stringValue(item.key),
      originalName: stringValue(item.originalName),
      contentType: stringValue(item.contentType),
      size: Math.max(0, parseNumber(item.size)),
    }))
    .filter((item) => item.key.length > 0)
    .slice(0, MAX_ASSET_IMAGES);
}

function toImageRecord(input: AssetImageInput) {
  return {
    id: crypto.randomUUID(),
    key: input.key,
    originalName: input.originalName,
    contentType: input.contentType,
    size: input.size,
    createdAt: new Date(),
  };
}

export async function addAssetImages(
  organizationId: Types.ObjectId,
  assetId: string,
  body: Record<string, unknown>,
  actor: AssetActor
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  const inputs = normalizeImageInputs(body.images ?? [body]);
  if (inputs.length === 0) {
    throw new AssetServiceError("validation", "At least one image is required");
  }
  if (asset.images.length + inputs.length > MAX_ASSET_IMAGES) {
    throw new AssetServiceError(
      "validation",
      `Assets can have up to ${MAX_ASSET_IMAGES} photos`
    );
  }

  asset.images.push(...inputs.map(toImageRecord));
  await asset.save();

  await logAssetActivity({
    organizationId,
    assetId: asset._id as Types.ObjectId,
    type: "edited",
    actor,
    message: inputs.length === 1 ? "Photo added" : `${inputs.length} photos added`,
  });

  return asset;
}

export async function removeAssetImage(
  organizationId: Types.ObjectId,
  assetId: string,
  imageId: string,
  actor: AssetActor
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  const before = asset.images.length;
  asset.images = asset.images.filter((image) => image.id !== imageId);
  if (asset.images.length === before) {
    throw new AssetServiceError("not_found", "Photo not found");
  }
  await asset.save();

  await logAssetActivity({
    organizationId,
    assetId: asset._id as Types.ObjectId,
    type: "edited",
    actor,
    message: "Photo removed",
  });

  return asset;
}

export async function setAssetCoverImage(
  organizationId: Types.ObjectId,
  assetId: string,
  imageId: string,
  actor: AssetActor
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  const index = asset.images.findIndex((image) => image.id === imageId);
  if (index === -1) {
    throw new AssetServiceError("not_found", "Photo not found");
  }
  if (index > 0) {
    const [image] = asset.images.splice(index, 1);
    asset.images.unshift(image!);
    await asset.save();

    await logAssetActivity({
      organizationId,
      assetId: asset._id as Types.ObjectId,
      type: "edited",
      actor,
      message: "Cover photo changed",
    });
  }

  return asset;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createAssetRecords(
  organizationId: Types.ObjectId,
  body: Record<string, unknown>,
  actor: AssetActor
): Promise<IAsset[]> {
  const input = normalizeAssetInput(body);
  if (!input.name) {
    throw new AssetServiceError("validation", "Asset name is required");
  }

  const copies = Math.min(100, Math.max(1, Math.round(parseNumber(body.copies, 1))));
  await validateReferences(organizationId, input);

  const category = input.categoryId
    ? await AssetCategory.findOne({ _id: input.categoryId, organizationId })
    : null;
  const depreciation: IAssetDepreciationParams = {
    ...depreciationDefaultsFromCategory(category),
    ...(input.depreciation ?? {}),
  };

  const codes = await nextAssetCodes(organizationId, copies);
  const assets: IAsset[] = [];
  // Photos attach only to the first created copy.
  const images = normalizeImageInputs(body.images).map(toImageRecord);

  for (const [index, assetCode] of codes.entries()) {
    const asset = await Asset.create({
      organizationId,
      assetCode,
      name: input.name,
      serialNumber: copies === 1 ? input.serialNumber ?? "" : "",
      description: input.description ?? "",
      categoryId: input.categoryId ?? null,
      purchaseDate: input.purchaseDate ?? null,
      purchaseCost: input.purchaseCost ?? 0,
      vendorName: input.vendorName ?? "",
      invoiceReference: input.invoiceReference ?? "",
      availableForUseDate: input.availableForUseDate ?? null,
      depreciation,
      assignedEmployeeId: input.assignedEmployeeId ?? null,
      locationId: input.locationId ?? null,
      condition: input.condition ?? "in_storage",
      warrantyExpiryDate: input.warrantyExpiryDate ?? null,
      amcExpiryDate: input.amcExpiryDate ?? null,
      images: index === 0 ? images : [],
    });

    await logAssetActivity({
      organizationId,
      assetId: asset._id as Types.ObjectId,
      type: "created",
      actor,
      message: `Asset ${asset.assetCode} created`,
    });
    assets.push(asset);
  }

  return assets;
}

export async function findAssetOrThrow(
  organizationId: Types.ObjectId,
  assetId: string
): Promise<IAsset> {
  if (!mongoose.Types.ObjectId.isValid(assetId)) {
    throw new AssetServiceError("not_found", "Asset not found");
  }

  const asset = await Asset.findOne({ _id: assetId, organizationId });
  if (!asset) {
    throw new AssetServiceError("not_found", "Asset not found");
  }
  return asset;
}

export async function updateAssetRecord(
  organizationId: Types.ObjectId,
  assetId: string,
  body: Record<string, unknown>,
  actor: AssetActor
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  if (asset.lifecycleStatus === "sold" || asset.lifecycleStatus === "scrapped") {
    throw new AssetServiceError("invalid_state", "Disposed assets cannot be edited");
  }

  const input = normalizeAssetInput(body);
  await validateReferences(organizationId, input);

  if (input.name !== undefined && !input.name) {
    throw new AssetServiceError("validation", "Asset name is required");
  }

  const depreciationBefore = JSON.stringify(asset.depreciation);
  const costBefore = asset.purchaseCost;
  const startBefore = depreciationStartDate(asset)?.getTime() ?? null;

  if (input.name !== undefined) asset.name = input.name;
  if (input.serialNumber !== undefined) asset.serialNumber = input.serialNumber;
  if (input.description !== undefined) asset.description = input.description;
  if (input.categoryId !== undefined) asset.categoryId = input.categoryId;
  if (input.purchaseDate !== undefined) asset.purchaseDate = input.purchaseDate;
  if (input.purchaseCost !== undefined) asset.purchaseCost = input.purchaseCost;
  if (input.vendorName !== undefined) asset.vendorName = input.vendorName;
  if (input.invoiceReference !== undefined) asset.invoiceReference = input.invoiceReference;
  if (input.availableForUseDate !== undefined) asset.availableForUseDate = input.availableForUseDate;
  if (input.warrantyExpiryDate !== undefined) asset.warrantyExpiryDate = input.warrantyExpiryDate;
  if (input.amcExpiryDate !== undefined) asset.amcExpiryDate = input.amcExpiryDate;
  if (input.depreciation) {
    asset.depreciation = { ...asset.depreciation, ...input.depreciation };
  }

  // Regenerate the schedule when depreciation inputs change on an active
  // asset. This rebuilds from base parameters: prior value adjustments stay in
  // the history but their effect on the schedule is recomputed away.
  const depreciationChanged =
    JSON.stringify(asset.depreciation) !== depreciationBefore ||
    asset.purchaseCost !== costBefore ||
    (depreciationStartDate(asset)?.getTime() ?? null) !== startBefore;

  if (asset.lifecycleStatus === "active" && depreciationChanged) {
    regenerateAssetSchedule(asset);
  }

  await asset.save();
  await logAssetActivity({
    organizationId,
    assetId: asset._id as Types.ObjectId,
    type: "edited",
    actor,
    message: `Asset ${asset.assetCode} updated`,
  });

  return asset;
}

export async function deleteAssetRecord(
  organizationId: Types.ObjectId,
  assetId: string
): Promise<void> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  if (asset.lifecycleStatus !== "draft") {
    throw new AssetServiceError("invalid_state", "Only draft assets can be deleted");
  }

  await Asset.deleteOne({ _id: asset._id, organizationId });
  await AssetActivity.deleteMany({ assetId: asset._id, organizationId });
}

// ---------------------------------------------------------------------------
// Lifecycle actions
// ---------------------------------------------------------------------------

export async function activateAsset(
  organizationId: Types.ObjectId,
  assetId: string,
  actor: AssetActor
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  if (asset.lifecycleStatus !== "draft") {
    throw new AssetServiceError("invalid_state", "Only draft assets can be activated");
  }
  if (asset.purchaseCost <= 0) {
    throw new AssetServiceError("validation", "A purchase cost is required before activation");
  }

  regenerateAssetSchedule(asset);
  asset.lifecycleStatus = "active";
  if (asset.condition === "in_storage" && asset.assignedEmployeeId) {
    asset.condition = "in_use";
  }
  await asset.save();

  await logAssetActivity({
    organizationId,
    assetId: asset._id as Types.ObjectId,
    type: "activated",
    actor,
    message: `Asset ${asset.assetCode} activated`,
  });

  return asset;
}

export async function assignAsset(
  organizationId: Types.ObjectId,
  assetId: string,
  body: Record<string, unknown>,
  actor: AssetActor
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  if (asset.lifecycleStatus === "sold" || asset.lifecycleStatus === "scrapped") {
    throw new AssetServiceError("invalid_state", "Disposed assets cannot be reassigned");
  }

  const employeeId = objectIdOrNull(body.employeeId);
  let employeeName = "";
  if (employeeId) {
    const employee = await Employee.findOne({ _id: employeeId, organizationId });
    if (!employee) throw new AssetServiceError("validation", "Employee not found");
    employeeName = employee.fullName;
  }

  asset.assignedEmployeeId = employeeId;
  await asset.save();

  await logAssetActivity({
    organizationId,
    assetId: asset._id as Types.ObjectId,
    type: "assigned",
    actor,
    message: employeeId
      ? `Assigned to ${employeeName}`
      : "Assignment cleared",
    payload: { employeeId: employeeId ? String(employeeId) : null, employeeName },
  });

  return asset;
}

export async function moveAsset(
  organizationId: Types.ObjectId,
  assetId: string,
  body: Record<string, unknown>,
  actor: AssetActor
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  if (asset.lifecycleStatus === "sold" || asset.lifecycleStatus === "scrapped") {
    throw new AssetServiceError("invalid_state", "Disposed assets cannot be moved");
  }

  const locationId = objectIdOrNull(body.locationId);
  let locationName = "";
  if (locationId) {
    const location = await AssetLocation.findOne({ _id: locationId, organizationId });
    if (!location) throw new AssetServiceError("validation", "Location not found");
    locationName = location.name;
  }

  asset.locationId = locationId;
  await asset.save();

  await logAssetActivity({
    organizationId,
    assetId: asset._id as Types.ObjectId,
    type: "moved",
    actor,
    message: locationId ? `Moved to ${locationName}` : "Location cleared",
    payload: { locationId: locationId ? String(locationId) : null, locationName },
  });

  return asset;
}

export async function setAssetCondition(
  organizationId: Types.ObjectId,
  assetId: string,
  body: Record<string, unknown>,
  actor: AssetActor
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  if (asset.lifecycleStatus === "sold" || asset.lifecycleStatus === "scrapped") {
    throw new AssetServiceError("invalid_state", "Disposed assets cannot change condition");
  }

  const condition = stringValue(body.condition) as AssetCondition;
  if (!ASSET_CONDITIONS.includes(condition)) {
    throw new AssetServiceError("validation", "Invalid asset condition");
  }

  const previous = asset.condition;
  asset.condition = condition;
  await asset.save();

  await logAssetActivity({
    organizationId,
    assetId: asset._id as Types.ObjectId,
    type: "condition_changed",
    actor,
    message: `Condition changed from ${previous.replaceAll("_", " ")} to ${condition.replaceAll("_", " ")}`,
    payload: { from: previous, to: condition },
  });

  return asset;
}

export async function adjustAssetValue(
  organizationId: Types.ObjectId,
  assetId: string,
  body: Record<string, unknown>,
  actor: AssetActor
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  if (asset.lifecycleStatus !== "active") {
    throw new AssetServiceError("invalid_state", "Only active assets can be revalued");
  }

  const date = parseDate(body.date) ?? new Date();
  const newValue = parseNumber(body.newValue, Number.NaN);
  if (!Number.isFinite(newValue) || newValue < 0) {
    throw new AssetServiceError("validation", "A valid new value is required");
  }

  const result = applyValueAdjustment({
    params: scheduleParamsFor(asset),
    schedule: asset.depreciationSchedule,
    adjustmentDate: date,
    newValue,
  });

  asset.depreciationSchedule = result.schedule as IAsset["depreciationSchedule"];
  asset.valueAdjustments.push({
    id: crypto.randomUUID(),
    date,
    previousBookValue: result.previousBookValue,
    newValue,
    reason: stringValue(body.reason),
    adjustedBy: actor.userId,
    createdAt: new Date(),
  });
  await asset.save();

  await logAssetActivity({
    organizationId,
    assetId: asset._id as Types.ObjectId,
    type: "adjusted",
    actor,
    message: `Value adjusted from ${result.previousBookValue.toFixed(2)} to ${newValue.toFixed(2)}`,
    payload: { previousBookValue: result.previousBookValue, newValue },
  });

  return asset;
}

export async function disposeAsset(
  organizationId: Types.ObjectId,
  assetId: string,
  body: Record<string, unknown>,
  actor: AssetActor
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  if (asset.lifecycleStatus !== "active") {
    throw new AssetServiceError("invalid_state", "Only active assets can be disposed");
  }

  const type = stringValue(body.type) as AssetDisposalType;
  if (type !== "sold" && type !== "scrapped") {
    throw new AssetServiceError("validation", "Disposal type must be sold or scrapped");
  }

  const date = parseDate(body.date) ?? new Date();
  const saleAmount = type === "sold" ? Math.max(0, parseNumber(body.saleAmount)) : 0;
  const bookValueAtDisposal = assetBookValueAsOf(asset, date);
  const gainLoss = Math.round((saleAmount - bookValueAtDisposal) * 100) / 100;

  asset.disposal = {
    type,
    date,
    saleAmount,
    buyerName: stringValue(body.buyerName),
    notes: stringValue(body.notes),
    bookValueAtDisposal,
    gainLoss,
  };
  asset.lifecycleStatus = type;
  asset.assignedEmployeeId = null;
  await asset.save();

  await logAssetActivity({
    organizationId,
    assetId: asset._id as Types.ObjectId,
    type: "disposed",
    actor,
    message:
      type === "sold"
        ? `Sold for ${saleAmount.toFixed(2)} (book value ${bookValueAtDisposal.toFixed(2)})`
        : `Scrapped (book value ${bookValueAtDisposal.toFixed(2)})`,
    payload: { type, saleAmount, bookValueAtDisposal, gainLoss },
  });

  return asset;
}

export async function addAssetRepair(
  organizationId: Types.ObjectId,
  assetId: string,
  body: Record<string, unknown>,
  actor: AssetActor
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  if (asset.lifecycleStatus === "sold" || asset.lifecycleStatus === "scrapped") {
    throw new AssetServiceError("invalid_state", "Disposed assets cannot log repairs");
  }

  const description = stringValue(body.description);
  if (!description) {
    throw new AssetServiceError("validation", "Repair description is required");
  }

  const repair = {
    id: crypto.randomUUID(),
    date: parseDate(body.date) ?? new Date(),
    description,
    cost: Math.max(0, parseNumber(body.cost)),
    loggedBy: actor.userId,
    createdAt: new Date(),
  };
  asset.repairs.push(repair);
  await asset.save();

  await logAssetActivity({
    organizationId,
    assetId: asset._id as Types.ObjectId,
    type: "repaired",
    actor,
    message: `Repair logged: ${description}`,
    payload: { repairId: repair.id, cost: repair.cost },
  });

  return asset;
}

export async function addAssetAttachment(
  organizationId: Types.ObjectId,
  assetId: string,
  body: Record<string, unknown>
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  const key = stringValue(body.key);
  if (!key) {
    throw new AssetServiceError("validation", "Attachment key is required");
  }

  asset.attachments.push({
    id: crypto.randomUUID(),
    key,
    originalName: stringValue(body.originalName),
    contentType: stringValue(body.contentType),
    size: Math.max(0, parseNumber(body.size)),
    createdAt: new Date(),
  });
  await asset.save();
  return asset;
}

export async function removeAssetAttachment(
  organizationId: Types.ObjectId,
  assetId: string,
  attachmentId: string
): Promise<IAsset> {
  const asset = await findAssetOrThrow(organizationId, assetId);
  const before = asset.attachments.length;
  asset.attachments = asset.attachments.filter(
    (attachment) => attachment.id !== attachmentId
  );
  if (asset.attachments.length === before) {
    throw new AssetServiceError("not_found", "Attachment not found");
  }
  await asset.save();
  return asset;
}

// ---------------------------------------------------------------------------
// Listing, stats, register
// ---------------------------------------------------------------------------

export interface AssetListFilters {
  page: number;
  limit: number;
  search: string;
  categoryId: string;
  locationId: string;
  employeeId: string;
  lifecycleStatus: string;
  condition: string;
}

export async function listAssetRecords(
  organizationId: Types.ObjectId,
  filters: AssetListFilters
) {
  const query: Record<string, unknown> = { organizationId };

  if (filters.categoryId && mongoose.Types.ObjectId.isValid(filters.categoryId)) {
    query.categoryId = new mongoose.Types.ObjectId(filters.categoryId);
  }
  if (filters.locationId && mongoose.Types.ObjectId.isValid(filters.locationId)) {
    query.locationId = new mongoose.Types.ObjectId(filters.locationId);
  }
  if (filters.employeeId && mongoose.Types.ObjectId.isValid(filters.employeeId)) {
    query.assignedEmployeeId = new mongoose.Types.ObjectId(filters.employeeId);
  }
  if (
    filters.lifecycleStatus &&
    ASSET_LIFECYCLE_STATUSES.includes(filters.lifecycleStatus as AssetLifecycleStatus)
  ) {
    query.lifecycleStatus = filters.lifecycleStatus;
  }
  if (filters.condition && ASSET_CONDITIONS.includes(filters.condition as AssetCondition)) {
    query.condition = filters.condition;
  }
  if (filters.search) {
    const pattern = new RegExp(
      filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i"
    );
    query.$or = [
      { name: pattern },
      { assetCode: pattern },
      { serialNumber: pattern },
      { vendorName: pattern },
    ];
  }

  const skip = (filters.page - 1) * filters.limit;
  const [assets, total] = await Promise.all([
    Asset.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(filters.limit)
      .populate("categoryId", "name")
      .populate("locationId", "name")
      .populate("assignedEmployeeId", "fullName")
      .lean(),
    Asset.countDocuments(query),
  ]);

  const now = new Date();
  return {
    assets: assets.map((asset) => ({
      ...asset,
      currentBookValue:
        asset.lifecycleStatus === "draft"
          ? asset.purchaseCost
          : assetBookValueAsOf(asset as unknown as IAsset, now),
    })),
    total,
  };
}

export async function getAssetStats(organizationId: Types.ObjectId) {
  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [counts, activeAssets] = await Promise.all([
    Asset.aggregate<{ _id: AssetLifecycleStatus; count: number }>([
      { $match: { organizationId } },
      { $group: { _id: "$lifecycleStatus", count: { $sum: 1 } } },
    ]),
    Asset.find({ organizationId, lifecycleStatus: "active" })
      .select("purchaseCost depreciation depreciationSchedule lifecycleStatus disposal condition warrantyExpiryDate")
      .lean(),
  ]);

  const countByStatus = Object.fromEntries(counts.map((row) => [row._id, row.count]));
  let totalPurchaseCost = 0;
  let currentBookValue = 0;
  let inRepair = 0;
  let warrantyExpiringSoon = 0;

  for (const asset of activeAssets) {
    totalPurchaseCost += asset.purchaseCost;
    currentBookValue += assetBookValueAsOf(asset as unknown as IAsset, now);
    if (asset.condition === "in_repair") inRepair += 1;
    if (
      asset.warrantyExpiryDate &&
      asset.warrantyExpiryDate >= now &&
      asset.warrantyExpiryDate <= in90Days
    ) {
      warrantyExpiringSoon += 1;
    }
  }

  return {
    totalAssets: counts.reduce((sum, row) => sum + row.count, 0),
    draftAssets: countByStatus.draft ?? 0,
    activeAssets: countByStatus.active ?? 0,
    disposedAssets: (countByStatus.sold ?? 0) + (countByStatus.scrapped ?? 0),
    totalPurchaseCost: Math.round(totalPurchaseCost * 100) / 100,
    currentBookValue: Math.round(currentBookValue * 100) / 100,
    inRepair,
    warrantyExpiringSoon,
  };
}

export interface DepreciationRegisterRow {
  assetId: string;
  assetCode: string;
  name: string;
  categoryName: string;
  lifecycleStatus: AssetLifecycleStatus;
  purchaseDate: Date | null;
  purchaseCost: number;
  accumulatedDepreciation: number;
  bookValue: number;
  disposalDate: Date | null;
  disposalType: AssetDisposalType | null;
}

export async function getDepreciationRegister(
  organizationId: Types.ObjectId,
  asOf: Date
): Promise<DepreciationRegisterRow[]> {
  const assets = await Asset.find({
    organizationId,
    lifecycleStatus: { $ne: "draft" },
  })
    .sort({ assetCode: 1 })
    .populate("categoryId", "name")
    .lean();

  return assets.map((asset) => {
    const disposed =
      asset.disposal && toUtcDay(asset.disposal.date) <= toUtcDay(asOf);
    const bookValue = disposed ? 0 : assetBookValueAsOf(asset as unknown as IAsset, asOf);
    const accumulated = disposed
      ? Math.round((asset.purchaseCost - asset.disposal!.bookValueAtDisposal) * 100) / 100
      : Math.round((asset.purchaseCost - bookValue) * 100) / 100;

    const category = asset.categoryId as unknown as { name?: string } | null;
    return {
      assetId: String(asset._id),
      assetCode: asset.assetCode,
      name: asset.name,
      categoryName: category?.name ?? "",
      lifecycleStatus: asset.lifecycleStatus,
      purchaseDate: asset.purchaseDate ?? null,
      purchaseCost: asset.purchaseCost,
      accumulatedDepreciation: accumulated,
      bookValue,
      disposalDate: asset.disposal?.date ?? null,
      disposalType: asset.disposal?.type ?? null,
    };
  });
}
