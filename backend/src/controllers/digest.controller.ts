import { createElement } from "react";
import type { Request, Response } from "express";
import { DigestPreference, type IDigestPreference } from "../models/digest-preference.model";
import { Email } from "../models/email.model";
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

    res.json(
      preference ?? {
        enabled: false,
        sections: DEFAULT_SECTIONS,
        sendHourUtc: 8,
      }
    );
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
    const sendHourUtc =
      typeof body.sendHourUtc === "number" &&
      Number.isInteger(body.sendHourUtc) &&
      body.sendHourUtc >= 0 &&
      body.sendHourUtc <= 23
        ? body.sendHourUtc
        : 8;

    const rawSections = body.sections ?? {};
    const sections = {
      emailVolume: typeof rawSections.emailVolume === "boolean" ? rawSections.emailVolume : true,
      rfqBreakdown: typeof rawSections.rfqBreakdown === "boolean" ? rawSections.rfqBreakdown : true,
      productRequests: typeof rawSections.productRequests === "boolean" ? rawSections.productRequests : true,
      matchQuality: typeof rawSections.matchQuality === "boolean" ? rawSections.matchQuality : true,
    };

    const preference = await DigestPreference.findOneAndUpdate(
      { userId: authReq.user.id, organizationId: organization._id },
      { enabled, sections, sendHourUtc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json(preference);
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
        Email.countDocuments({ organizationId: orgId, userId, date: { $gte: from, $lt: to } }),
        RFQ.aggregate([
          { $match: { organizationId: orgId, userId, createdAt: { $gte: from, $lt: to } } },
          { $group: { _id: null, rfqs: { $sum: { $cond: ["$isRFQ", 1, 0] } }, nonRfqs: { $sum: { $cond: ["$isRFQ", 0, 1] } } } },
        ]),
      ]);
      const row = rfqDocs[0] ?? { rfqs: 0, nonRfqs: 0 };
      digestSections.emailVolume = { total, rfqs: row.rfqs, nonRfqs: row.nonRfqs };
    }

    if (sections.rfqBreakdown) {
      const [total, failed] = await Promise.all([
        RFQ.countDocuments({ organizationId: orgId, userId, isRFQ: true, createdAt: { $gte: from, $lt: to } }),
        RFQ.countDocuments({ organizationId: orgId, userId, isRFQ: true, errorMessage: { $ne: null }, createdAt: { $gte: from, $lt: to } }),
      ]);
      digestSections.rfqBreakdown = { total, processed: total - failed, failed };
    }

    if (sections.productRequests) {
      const productAgg = await RFQ.aggregate([
        { $match: { organizationId: orgId, userId, isRFQ: true, createdAt: { $gte: from, $lt: to } } },
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
        { $match: { organizationId: orgId, userId, isRFQ: true, createdAt: { $gte: from, $lt: to } } },
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
