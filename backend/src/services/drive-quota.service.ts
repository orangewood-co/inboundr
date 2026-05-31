import type { Types } from "mongoose";
import { DriveQuota, type IDriveQuota } from "../models/drive-quota.model";

const DEFAULT_ORG_QUOTA_BYTES = Number(process.env.DRIVE_DEFAULT_QUOTA_BYTES ?? 10 * 1024 * 1024 * 1024);

export async function getOrCreateDriveQuota(organizationId: Types.ObjectId): Promise<IDriveQuota> {
  const existing = await DriveQuota.findOne({ organizationId });
  if (existing) return existing;

  return DriveQuota.create({
    organizationId,
    limitBytes: DEFAULT_ORG_QUOTA_BYTES,
    usedBytes: 0,
    reservedBytes: 0,
  });
}

export async function assertDriveQuotaAvailable(organizationId: Types.ObjectId, bytes: number): Promise<void> {
  const quota = await getOrCreateDriveQuota(organizationId);
  if (quota.limitBytes > 0 && quota.usedBytes + quota.reservedBytes + bytes > quota.limitBytes) {
    throw new Error("Organization Drive storage quota exceeded");
  }
}

export async function reserveDriveBytes(organizationId: Types.ObjectId, bytes: number): Promise<void> {
  await assertDriveQuotaAvailable(organizationId, bytes);
  await DriveQuota.updateOne({ organizationId }, { $inc: { reservedBytes: bytes } });
}

export async function commitReservedDriveBytes(organizationId: Types.ObjectId, bytes: number): Promise<void> {
  await DriveQuota.updateOne(
    { organizationId },
    {
      $inc: {
        usedBytes: bytes,
        reservedBytes: -bytes,
      },
    }
  );
}

export async function releaseReservedDriveBytes(organizationId: Types.ObjectId, bytes: number): Promise<void> {
  await DriveQuota.updateOne(
    { organizationId },
    {
      $inc: {
        reservedBytes: -bytes,
      },
    }
  );
}

export async function releaseUsedDriveBytes(organizationId: Types.ObjectId, bytes: number): Promise<void> {
  await DriveQuota.updateOne(
    { organizationId },
    {
      $inc: {
        usedBytes: -bytes,
      },
    }
  );
}

export async function setDriveQuotaLimit(organizationId: Types.ObjectId, limitBytes: number): Promise<IDriveQuota> {
  return DriveQuota.findOneAndUpdate(
    { organizationId },
    { $set: { limitBytes: Math.max(0, Math.floor(limitBytes)) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).orFail();
}
