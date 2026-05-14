import type { Request, Response } from "express";
import mongoose, { type PipelineStage } from "mongoose";
import { Email } from "../models/email.model";
import { GmailAccount } from "../models/gmail-account.model";
import { OrganizationMember } from "../models/organization-member.model";
import { RFQ } from "../models/rfq.model";
import type { AuthenticatedRequest, OrganizationRequest } from "../middleware/auth.middleware";

type StatsRange = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<StatsRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function parseRange(value: unknown): StatsRange {
  return value === "7d" || value === "90d" ? value : "30d";
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildDateWindow(range: StatsRange): { from: Date; to: Date; days: string[] } {
  const today = startOfUtcDay(new Date());
  const from = new Date(today);
  from.setUTCDate(today.getUTCDate() - RANGE_DAYS[range] + 1);
  const to = new Date(today);
  to.setUTCDate(today.getUTCDate() + 1);

  const days: string[] = [];
  for (const current = new Date(from); current < to; current.setUTCDate(current.getUTCDate() + 1)) {
    days.push(formatDay(current));
  }

  return { from, to, days };
}

function asObjectId(value: unknown): mongoose.Types.ObjectId | null {
  if (typeof value !== "string" || value === "all") return null;
  return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

export async function getStatsOverview(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const organization = (req as OrganizationRequest).organization;
    const organizationId = organization._id;
    const range = parseRange(req.query.range);
    const { from, to, days } = buildDateWindow(range);
    const member = typeof req.query.member === "string" && req.query.member !== "all" ? req.query.member : null;
    const gmailAccountId = asObjectId(req.query.gmailAccount);

    const emailMatch: Record<string, unknown> = {
      organizationId,
      date: { $gte: from, $lt: to },
    };
    const rfqMatch: Record<string, unknown> = {
      organizationId,
      createdAt: { $gte: from, $lt: to },
    };

    if (member) {
      emailMatch.userId = member;
      rfqMatch.userId = member;
    }
    if (gmailAccountId) {
      emailMatch.gmailAccountId = gmailAccountId;
      rfqMatch.gmailAccountId = gmailAccountId;
    }

    const dailyEmailPipeline: PipelineStage[] = [
      { $match: emailMatch },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          emails: { $sum: 1 },
          failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
        },
      },
    ];

    const dailyRfqPipeline: PipelineStage[] = [
      { $match: rfqMatch },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          rfqs: { $sum: { $cond: ["$isRFQ", 1, 0] } },
          nonRfqs: { $sum: { $cond: ["$isRFQ", 0, 1] } },
          products: { $sum: { $size: { $ifNull: ["$queryProducts", []] } } },
        },
      },
    ];

    const [
      dailyEmails,
      dailyRfqs,
      totals,
      byMemberEmails,
      byMemberRfqs,
      accounts,
      byAccountEmails,
      byAccountRfqs,
      productBreakdown,
      matchQualityRows,
      members,
    ] = await Promise.all([
      Email.aggregate(dailyEmailPipeline),
      RFQ.aggregate(dailyRfqPipeline),
      RFQ.aggregate([
        { $match: rfqMatch },
        {
          $group: {
            _id: null,
            rfqs: { $sum: { $cond: ["$isRFQ", 1, 0] } },
            nonRfqs: { $sum: { $cond: ["$isRFQ", 0, 1] } },
            products: { $sum: { $size: { $ifNull: ["$queryProducts", []] } } },
            failed: { $sum: { $cond: [{ $ne: ["$errorMessage", null] }, 1, 0] } },
          },
        },
      ]),
      Email.aggregate([{ $match: emailMatch }, { $group: { _id: "$userId", emails: { $sum: 1 } } }]),
      RFQ.aggregate([
        { $match: rfqMatch },
        {
          $group: {
            _id: "$userId",
            rfqs: { $sum: { $cond: ["$isRFQ", 1, 0] } },
            products: { $sum: { $size: { $ifNull: ["$queryProducts", []] } } },
          },
        },
      ]),
      GmailAccount.find({ organizationId }).select("emailAddress status").lean(),
      Email.aggregate([{ $match: emailMatch }, { $group: { _id: "$gmailAccountId", emails: { $sum: 1 } } }]),
      RFQ.aggregate([
        { $match: rfqMatch },
        { $group: { _id: "$gmailAccountId", rfqs: { $sum: { $cond: ["$isRFQ", 1, 0] } } } },
      ]),
      RFQ.aggregate([
        { $match: { ...rfqMatch, isRFQ: true } },
        { $unwind: "$queryProducts" },
        {
          $group: {
            _id: { $toLower: "$queryProducts.name" },
            name: { $first: "$queryProducts.name" },
            count: { $sum: 1 },
            quantity: { $sum: "$queryProducts.quantity" },
          },
        },
        { $sort: { quantity: -1, count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, name: 1, count: 1, quantity: 1 } },
      ]),
      RFQ.aggregate([
        { $match: { ...rfqMatch, isRFQ: true } },
        { $unwind: "$searchResults" },
        { $group: { _id: "$searchResults.status", count: { $sum: 1 } } },
      ]),
      OrganizationMember.find({ organizationId }).lean(),
    ]);

    const dailyEmailMap = new Map(dailyEmails.map((row) => [row._id, row]));
    const dailyRfqMap = new Map(dailyRfqs.map((row) => [row._id, row]));
    const daily = days.map((date) => ({
      date,
      emails: dailyEmailMap.get(date)?.emails ?? 0,
      rfqs: dailyRfqMap.get(date)?.rfqs ?? 0,
      nonRfqs: dailyRfqMap.get(date)?.nonRfqs ?? 0,
      products: dailyRfqMap.get(date)?.products ?? 0,
    }));

    const emailTotal = daily.reduce((sum, row) => sum + row.emails, 0);
    const totalsRow = totals[0] ?? {};

    const memberEmailMap = new Map(byMemberEmails.map((row) => [row._id, row.emails]));
    const memberRfqMap = new Map(byMemberRfqs.map((row) => [row._id, row]));
    const memberIds = new Set<string>([
      ...members.map((item) => item.userId),
      ...byMemberEmails.map((item) => item._id),
      ...byMemberRfqs.map((item) => item._id),
    ]);
    const byMember = Array.from(memberIds).map((userId) => ({
      userId,
      name: userId === authReq.user.id ? authReq.user.name ?? "Current user" : "Organization member",
      email: userId === authReq.user.id ? authReq.user.email ?? "" : "",
      emails: memberEmailMap.get(userId) ?? 0,
      rfqs: memberRfqMap.get(userId)?.rfqs ?? 0,
      products: memberRfqMap.get(userId)?.products ?? 0,
    }));

    const accountEmailMap = new Map(byAccountEmails.map((row) => [row._id?.toString(), row.emails]));
    const accountRfqMap = new Map(byAccountRfqs.map((row) => [row._id?.toString(), row.rfqs]));
    const byGmailAccount = accounts.map((account) => {
      const id = account._id.toString();
      return {
        id,
        emailAddress: account.emailAddress,
        emails: accountEmailMap.get(id) ?? 0,
        rfqs: accountRfqMap.get(id) ?? 0,
      };
    });

    const matchQuality = { matched: 0, ambiguous: 0, noMatch: 0 };
    for (const row of matchQualityRows) {
      if (row._id === "matched") matchQuality.matched = row.count;
      if (row._id === "ambiguous") matchQuality.ambiguous = row.count;
      if (row._id === "no_match") matchQuality.noMatch = row.count;
    }

    res.json({
      range: { from: formatDay(from), to: formatDay(new Date(to.getTime() - 1)), bucket: "day" },
      totals: {
        emails: emailTotal,
        rfqs: totalsRow.rfqs ?? 0,
        nonRfqs: totalsRow.nonRfqs ?? 0,
        products: totalsRow.products ?? 0,
        failed: totalsRow.failed ?? 0,
      },
      daily,
      byMember,
      byGmailAccount,
      productBreakdown,
      matchQuality,
    });
  } catch (err) {
    console.error("Error fetching stats overview:", err);
    res.status(500).json({ error: "Failed to fetch stats overview" });
  }
}
