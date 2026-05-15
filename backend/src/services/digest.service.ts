import { createElement } from "react";
import mongoose from "mongoose";
import { DigestPreference, type IDigestPreference } from "../models/digest-preference.model";
import { Email } from "../models/email.model";
import { RFQ } from "../models/rfq.model";
import { Organization } from "../models/organization.model";
import { DailyDigest, type DailyDigestProps } from "../emails/daily-digest";
import { sendEmail } from "../lib/email";

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

interface BetterAuthUser {
  _id: string;
  id: string;
  name: string | null;
  email: string;
}

async function getUsersByIds(userIds: string[]): Promise<Map<string, BetterAuthUser>> {
  const db = mongoose.connection.db;
  if (!db) return new Map();

  const users = await db
    .collection("user")
    .find({ id: { $in: userIds } })
    .project({ id: 1, name: 1, email: 1 })
    .toArray();

  const map = new Map<string, BetterAuthUser>();
  for (const user of users) {
    map.set(user.id as string, user as unknown as BetterAuthUser);
  }
  return map;
}

function yesterdayRange(): { from: Date; to: Date; label: string } {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 1);
  const label = from.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return { from, to, label };
}

async function aggregateForUser(
  pref: IDigestPreference,
  from: Date,
  to: Date
): Promise<DailyDigestProps["sections"]> {
  const sections: DailyDigestProps["sections"] = {};
  const orgId = pref.organizationId;
  const userId = pref.userId;

  if (pref.sections.emailVolume) {
    const [total, rfqDocs] = await Promise.all([
      Email.countDocuments({ organizationId: orgId, userId, date: { $gte: from, $lt: to } }),
      RFQ.aggregate([
        { $match: { organizationId: orgId, userId, createdAt: { $gte: from, $lt: to } } },
        {
          $group: {
            _id: null,
            rfqs: { $sum: { $cond: ["$isRFQ", 1, 0] } },
            nonRfqs: { $sum: { $cond: ["$isRFQ", 0, 1] } },
          },
        },
      ]),
    ]);
    const rfqRow = rfqDocs[0] ?? { rfqs: 0, nonRfqs: 0 };
    sections.emailVolume = { total, rfqs: rfqRow.rfqs, nonRfqs: rfqRow.nonRfqs };
  }

  if (pref.sections.rfqBreakdown) {
    const [total, failed] = await Promise.all([
      RFQ.countDocuments({ organizationId: orgId, userId, isRFQ: true, createdAt: { $gte: from, $lt: to } }),
      RFQ.countDocuments({ organizationId: orgId, userId, isRFQ: true, errorMessage: { $ne: null }, createdAt: { $gte: from, $lt: to } }),
    ]);
    sections.rfqBreakdown = { total, processed: total - failed, failed };
  }

  if (pref.sections.productRequests) {
    const productAgg = await RFQ.aggregate([
      { $match: { organizationId: orgId, userId, isRFQ: true, createdAt: { $gte: from, $lt: to } } },
      { $unwind: "$queryProducts" },
      {
        $group: {
          _id: { $toLower: "$queryProducts.name" },
          name: { $first: "$queryProducts.name" },
          quantity: { $sum: "$queryProducts.quantity" },
        },
      },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, name: 1, quantity: 1 } },
    ]);
    const total = productAgg.reduce((sum, row) => sum + row.quantity, 0);
    sections.productRequests = { total, topProducts: productAgg };
  }

  if (pref.sections.matchQuality) {
    const matchAgg = await RFQ.aggregate([
      { $match: { organizationId: orgId, userId, isRFQ: true, createdAt: { $gte: from, $lt: to } } },
      { $unwind: "$searchResults" },
      { $group: { _id: "$searchResults.status", count: { $sum: 1 } } },
    ]);
    let matched = 0;
    let ambiguous = 0;
    let noMatch = 0;
    for (const row of matchAgg) {
      if (row._id === "matched") matched = row.count;
      if (row._id === "ambiguous") ambiguous = row.count;
      if (row._id === "no_match") noMatch = row.count;
    }
    const total = matched + ambiguous + noMatch;
    const rate = total > 0 ? Math.round((matched / total) * 100) : 0;
    sections.matchQuality = { matched, ambiguous, noMatch, rate };
  }

  return sections;
}

export async function sendHourlyDigestBatch(): Promise<void> {
  const currentHour = new Date().getUTCHours();

  const preferences = await DigestPreference.find({
    enabled: true,
    sendHourUtc: currentHour,
  }).lean();

  if (preferences.length === 0) return;

  const { from, to, label: dateLabel } = yesterdayRange();
  const userIds = preferences.map((pref) => pref.userId);
  const userMap = await getUsersByIds(userIds);

  const orgIds = [...new Set(preferences.map((pref) => pref.organizationId.toString()))];
  const orgs = await Organization.find({ _id: { $in: orgIds } }).lean();
  const orgMap = new Map(orgs.map((org) => [org._id.toString(), org]));

  for (const pref of preferences) {
    try {
      const user = userMap.get(pref.userId);
      if (!user?.email) continue;

      const org = orgMap.get(pref.organizationId.toString());
      const orgName = org?.name ?? "Your organization";

      const sections = await aggregateForUser(pref as unknown as IDigestPreference, from, to);

      const hasContent = Object.values(sections).some(
        (section) => section !== undefined
      );
      if (!hasContent) continue;

      await sendEmail({
        to: user.email,
        subject: `Daily Stats Digest — ${dateLabel}`,
        react: createElement(DailyDigest, {
          userName: user.name ?? "",
          organizationName: orgName,
          date: dateLabel,
          sections,
          statsPageUrl: `${frontendOrigin}/stats`,
        }),
      });
    } catch (err) {
      console.error(`Failed to send digest to user ${pref.userId}:`, err);
    }
  }
}
