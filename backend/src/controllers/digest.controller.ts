import { createElement } from "react";
import type { Request, Response } from "express";
import mongoose from "mongoose";
import { DigestPreference, type IDigestPreference } from "../models/digest-preference.model";
import { Email } from "../models/email.model";
import { OrganizationMember } from "../models/organization-member.model";
import { RFQ } from "../models/rfq.model";
import { DailyDigest } from "../emails/daily-digest";
import { sendEmail } from "../lib/email";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";

const DEFAULT_SECTIONS = {
  emailVolume: true,
  rfqBreakdown: true,
  productRequests: true,
  matchQuality: true,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function resolveUsersByIds(userIds: string[]) {
  const db = mongoose.connection.db;
  if (!db || userIds.length === 0) return new Map<string, { name?: string; email?: string }>();

  const objectIds = userIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const users = await db
    .collection("user")
    .find({
      $or: [
        { id: { $in: userIds } },
        ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
      ],
    })
    .project({ id: 1, name: 1, email: 1 })
    .toArray();

  const map = new Map<string, { name?: string; email?: string }>();
  for (const user of users) {
    map.set(user.id as string, user);
    map.set(String(user._id), user);
  }
  return map;
}

async function listDigestMembers(organizationId: mongoose.Types.ObjectId) {
  const members = await OrganizationMember.find({ organizationId })
    .sort({ createdAt: 1 })
    .lean();
  const users = await resolveUsersByIds(members.map((member) => member.userId));

  return members.map((member) => {
    const user = users.get(member.userId);
    return {
      _id: member._id,
      userId: member.userId,
      role: member.role,
      userName: user?.name ?? null,
      userEmail: user?.email ?? null,
      createdAt: member.createdAt,
    };
  });
}

function normalizeEmails(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const item of value) {
    const email = String(item ?? "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  return emails;
}

function normalizeTime(value: unknown): string {
  const time = String(value ?? "").trim();
  return TIME_RE.test(time) ? time : "08:00";
}

function normalizeTimezone(value: unknown): string {
  const timezone = String(value ?? "").trim();
  if (!timezone) return "UTC";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "UTC";
  }
}

function sendHourUtcFromLocal(sendTimeLocal: string, timezone: string): number {
  const [hour, minute] = sendTimeLocal.split(":").map(Number);
  const now = new Date();
  const utcGuess = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(utcGuess);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute)
  );
  const offsetMs = localAsUtc - utcGuess.getTime();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute) - offsetMs).getUTCHours();
}

async function normalizeMemberRecipients(organizationId: mongoose.Types.ObjectId, value: unknown): Promise<string[]> {
  if (!Array.isArray(value)) return [];
  const requested = [...new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean))];
  if (requested.length === 0) return [];

  const members = await OrganizationMember.find({
    organizationId,
    userId: { $in: requested },
  }).lean();
  const valid = new Set(members.map((member) => member.userId));
  return requested.filter((userId) => valid.has(userId));
}

function preferenceResponse(preference: Partial<IDigestPreference> | null, members: Awaited<ReturnType<typeof listDigestMembers>>) {
  const recipientMode = preference?.recipientMode ?? "all_members";
  const memberRecipientUserIds =
    recipientMode === "custom"
      ? preference?.memberRecipientUserIds ?? []
      : members.map((member) => member.userId);
  const externalRecipientEmails = preference?.externalRecipientEmails ?? [];

  return {
    enabled: preference?.enabled ?? false,
    sections: preference?.sections ?? DEFAULT_SECTIONS,
    recipientMode,
    memberRecipientUserIds,
    externalRecipientEmails,
    sendTimeLocal: preference?.sendTimeLocal ?? "08:00",
    timezone: preference?.timezone ?? "UTC",
    sendHourUtc: preference?.sendHourUtc ?? 8,
    members,
    recipientSummary: {
      memberCount: memberRecipientUserIds.length,
      externalCount: externalRecipientEmails.length,
      totalCount: memberRecipientUserIds.length + externalRecipientEmails.length,
    },
  };
}

export async function getDigestPreferences(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;

    const preference = await DigestPreference.findOne({
      userId: authReq.user.id,
      organizationId: organization._id,
    }).lean();
    const members = await listDigestMembers(organization._id);

    res.json(preferenceResponse(preference, members));
  } catch (err) {
    console.error("Error fetching digest preferences:", err);
    res.status(500).json({ error: "Failed to fetch digest preferences" });
  }
}

export async function updateDigestPreferences(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const body = req.body ?? {};

    const enabled = typeof body.enabled === "boolean" ? body.enabled : false;
    const sendTimeLocal = normalizeTime(body.sendTimeLocal);
    const timezone = normalizeTimezone(body.timezone);
    const sendHourUtc = sendHourUtcFromLocal(sendTimeLocal, timezone);
    const recipientMode = body.recipientMode === "custom" ? "custom" : "all_members";
    const memberRecipientUserIds =
      recipientMode === "custom"
        ? await normalizeMemberRecipients(organization._id, body.memberRecipientUserIds)
        : [];
    const externalRecipientEmails =
      recipientMode === "custom" ? normalizeEmails(body.externalRecipientEmails) : [];

    if (recipientMode === "custom" && memberRecipientUserIds.length + externalRecipientEmails.length === 0) {
      res.status(400).json({ error: "Select at least one digest recipient" });
      return;
    }

    const rawSections = body.sections ?? {};
    const sections = {
      emailVolume: typeof rawSections.emailVolume === "boolean" ? rawSections.emailVolume : true,
      rfqBreakdown: typeof rawSections.rfqBreakdown === "boolean" ? rawSections.rfqBreakdown : true,
      productRequests: typeof rawSections.productRequests === "boolean" ? rawSections.productRequests : true,
      matchQuality: typeof rawSections.matchQuality === "boolean" ? rawSections.matchQuality : true,
    };

    const preference = await DigestPreference.findOneAndUpdate(
      { userId: authReq.user.id, organizationId: organization._id },
      {
        enabled,
        sections,
        recipientMode,
        memberRecipientUserIds,
        externalRecipientEmails,
        sendTimeLocal,
        timezone,
        sendHourUtc,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    const members = await listDigestMembers(organization._id);

    res.json(preferenceResponse(preference, members));
  } catch (err) {
    console.error("Error updating digest preferences:", err);
    res.status(500).json({ error: "Failed to update digest preferences" });
  }
}

export async function sendTestDigest(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const orgId = organization._id;
    const userId = authReq.user.id;
    const userEmail = authReq.user.email;
    const userName = authReq.user.name ?? "";

    if (!userEmail) {
      res.status(400).json({ error: "No email address on your account" });
      return;
    }

    const pref = await DigestPreference.findOne({ userId, organizationId: orgId }).lean();
    const sections = pref?.sections ?? DEFAULT_SECTIONS;

    const now = new Date();
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 1);

    const digestSections: Record<string, unknown> = {};

    if (sections.emailVolume) {
      const [total, rfqDocs] = await Promise.all([
        Email.countDocuments({ organizationId: orgId, date: { $gte: from, $lt: to } }),
        RFQ.aggregate([
          { $match: { organizationId: orgId, createdAt: { $gte: from, $lt: to } } },
          { $group: { _id: null, rfqs: { $sum: { $cond: ["$isRFQ", 1, 0] } }, nonRfqs: { $sum: { $cond: ["$isRFQ", 0, 1] } } } },
        ]),
      ]);
      const row = rfqDocs[0] ?? { rfqs: 0, nonRfqs: 0 };
      digestSections.emailVolume = { total, rfqs: row.rfqs, nonRfqs: row.nonRfqs };
    }

    if (sections.rfqBreakdown) {
      const [total, failed] = await Promise.all([
        RFQ.countDocuments({ organizationId: orgId, isRFQ: true, createdAt: { $gte: from, $lt: to } }),
        RFQ.countDocuments({ organizationId: orgId, isRFQ: true, errorMessage: { $ne: null }, createdAt: { $gte: from, $lt: to } }),
      ]);
      digestSections.rfqBreakdown = { total, processed: total - failed, failed };
    }

    if (sections.productRequests) {
      const productAgg = await RFQ.aggregate([
        { $match: { organizationId: orgId, isRFQ: true, createdAt: { $gte: from, $lt: to } } },
        { $unwind: "$queryProducts" },
        { $group: { _id: { $toLower: "$queryProducts.name" }, name: { $first: "$queryProducts.name" }, quantity: { $sum: "$queryProducts.quantity" } } },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
        { $project: { _id: 0, name: 1, quantity: 1 } },
      ]);
      const total = productAgg.reduce((sum: number, r: { quantity: number }) => sum + r.quantity, 0);
      digestSections.productRequests = { total, topProducts: productAgg };
    }

    if (sections.matchQuality) {
      const matchAgg = await RFQ.aggregate([
        { $match: { organizationId: orgId, isRFQ: true, createdAt: { $gte: from, $lt: to } } },
        { $unwind: "$searchResults" },
        { $group: { _id: "$searchResults.status", count: { $sum: 1 } } },
      ]);
      let matched = 0, ambiguous = 0, noMatch = 0;
      for (const row of matchAgg) {
        if (row._id === "matched") matched = row.count;
        if (row._id === "ambiguous") ambiguous = row.count;
        if (row._id === "no_match") noMatch = row.count;
      }
      const total = matched + ambiguous + noMatch;
      digestSections.matchQuality = { matched, ambiguous, noMatch, rate: total > 0 ? Math.round((matched / total) * 100) : 0 };
    }

    const dateLabel = from.toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    });

    const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

    await sendEmail({
      to: userEmail,
      subject: `[TEST] Daily Stats Digest — ${dateLabel}`,
      react: createElement(DailyDigest, {
        userName,
        organizationName: organization.name,
        date: dateLabel,
        sections: digestSections as any,
        statsPageUrl: `${frontendOrigin}/stats`,
      }),
    });

    res.json({ message: `Test digest sent to ${userEmail}` });
  } catch (err) {
    console.error("Error sending test digest:", err);
    res.status(500).json({ error: "Failed to send test digest" });
  }
}
