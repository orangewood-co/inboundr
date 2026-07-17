import { connectDB } from "../config/database.config";
import { Organization } from "../models/organization.model";
import { ProductSettings } from "../models/product-settings.model";
import { RFQ } from "../models/rfq.model";
import { RFQReply } from "../models/rfq-reply.model";
import { GmailAccount } from "../models/gmail-account.model";
import { OrganizationMember } from "../models/organization-member.model";
import { Types } from "mongoose";

const LEGACY_SEARCH_PROFILE = {
  synonyms: {
    analog: ["analogue"],
    analogue: ["analog"],
    digimatic: ["digital"],
    digital: ["digimatic"],
    mic: ["micrometer"],
    mics: ["micrometer"],
    mike: ["micrometer"],
    vernier: ["caliper", "calliper"],
  },
  stopWords: ["quotation", "quote", "required", "please"],
  instructions:
    "Preserve metrology ranges, dimensions, catalogue codes, and manufacturer names when matching.",
  matchThreshold: 35,
  ambiguityGap: 30,
};

async function organizationForUser(userId: string) {
  const owned = await Organization.find({ ownerUserId: userId }).select("_id").lean();
  const memberships = await OrganizationMember.find({ userId }).select("organizationId").lean();
  const organizationIds = [...new Set([
    ...owned.map((organization) => organization._id.toString()),
    ...memberships.map((membership) => membership.organizationId.toString()),
  ])];
  return organizationIds.length === 1 && organizationIds[0]
    ? new Types.ObjectId(organizationIds[0])
    : null;
}

async function migrateGenericProductsAndRfqs() {
  await connectDB();
  const organizations = await Organization.find({}).select("_id").lean();

  for (const organization of organizations) {
    await ProductSettings.updateOne(
      { organizationId: organization._id },
      {
        $setOnInsert: {
          organizationId: organization._id,
          terminology: {
            singular: "Product",
            plural: "Products",
            skuLabel: "Product code",
            manufacturerLabel: "Brand",
            taxCodeLabel: "HSN code",
            taxRateLabel: "GST rate",
          },
          fieldDefinitions: [],
          adjustmentDefinitions: [
            {
              id: "legacy.calibration",
              code: "calibration",
              label: "Calibration",
              type: "fixed",
              defaultValue: 0,
              taxable: false,
              isActive: true,
            },
          ],
          search: LEGACY_SEARCH_PROFILE,
        },
      },
      { upsert: true }
    );
  }

  const unscopedRfqs = await RFQ.find({
    $or: [{ organizationId: { $exists: false } }, { organizationId: null }],
  }).select("_id gmailAccountId userId").lean();
  let scopedRfqs = 0;
  let unresolvedRecords = 0;
  for (const rfq of unscopedRfqs) {
    const account = await GmailAccount.findById(rfq.gmailAccountId).select("organizationId").lean();
    const organizationId = account?.organizationId ?? await organizationForUser(rfq.userId);
    if (!organizationId) {
      console.warn(`Skipped RFQ ${rfq._id}: Gmail account has no organization`);
      unresolvedRecords++;
      continue;
    }
    await RFQ.updateOne(
      { _id: rfq._id, $or: [{ organizationId: { $exists: false } }, { organizationId: null }] },
      { $set: { organizationId } }
    );
    await RFQReply.updateMany(
      { rfqId: rfq._id, $or: [{ organizationId: { $exists: false } }, { organizationId: null }] },
      { $set: { organizationId } }
    );
    scopedRfqs++;
  }

  const unscopedReplies = await RFQReply.find({
    $or: [{ organizationId: { $exists: false } }, { organizationId: null }],
  }).select("_id rfqId").lean();
  let scopedReplies = 0;
  for (const reply of unscopedReplies) {
    const rfq = await RFQ.findById(reply.rfqId).select("organizationId gmailAccountId userId").lean();
    let organizationId = rfq?.organizationId ?? null;
    if (!organizationId && rfq?.gmailAccountId) {
      const account = await GmailAccount.findById(rfq.gmailAccountId).select("organizationId").lean();
      organizationId = account?.organizationId ?? null;
    }
    if (!organizationId && rfq?.userId) {
      organizationId = await organizationForUser(rfq.userId);
    }
    if (!organizationId) {
      console.warn(`Skipped RFQ reply ${reply._id}: unable to resolve organization`);
      unresolvedRecords++;
      continue;
    }
    await RFQReply.updateOne({ _id: reply._id }, { $set: { organizationId } });
    scopedReplies++;
  }

  const rfqResult = await RFQ.collection.updateMany(
    {},
    [
      {
        $set: {
          searchResults: {
            $map: {
              input: { $ifNull: ["$searchResults", []] },
              as: "result",
              in: {
                $mergeObjects: [
                  "$$result",
                  {
                    matches: {
                      $map: {
                        input: { $ifNull: ["$$result.matches", []] },
                        as: "match",
                        in: {
                          $mergeObjects: [
                            "$$match",
                            {
                              tax: {
                                $ifNull: [
                                  "$$match.tax",
                                  {
                                    code: "$$match.hsnCode",
                                    rate: "$$match.gstRate",
                                    label: "GST",
                                  },
                                ],
                              },
                              defaultAdjustments: {
                                $cond: [
                                  { $gt: [{ $size: { $ifNull: ["$$match.defaultAdjustments", []] } }, 0] },
                                  "$$match.defaultAdjustments",
                                  { $cond: [
                                  { $gt: [{ $ifNull: ["$$match.calibrationCharges", 0] }, 0] },
                                  [{
                                    id: "legacy.calibration",
                                    code: "calibration",
                                    label: "Calibration",
                                    type: "fixed",
                                    value: "$$match.calibrationCharges",
                                    taxable: false,
                                  }],
                                  [],
                                  ] },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
          savedQuoteProducts: {
            $map: {
              input: { $ifNull: ["$savedQuoteProducts", []] },
              as: "line",
              in: {
                $mergeObjects: [
                  "$$line",
                  {
                    tax: {
                      $ifNull: [
                        "$$line.tax",
                        { code: "$$line.hsnCode", rate: "$$line.gstRate", label: "GST" },
                      ],
                    },
                    adjustments: {
                      $cond: [
                        { $gt: [{ $size: { $ifNull: ["$$line.adjustments", []] } }, 0] },
                        "$$line.adjustments",
                        { $cond: [
                        { $gt: [{ $ifNull: ["$$line.calibrationCharges", 0] }, 0] },
                        [{
                          id: "legacy.calibration",
                          code: "calibration",
                          label: "Calibration",
                          type: "fixed",
                          value: "$$line.calibrationCharges",
                          amount: "$$line.calibrationCharges",
                          taxable: false,
                        }],
                        [],
                        ] },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
    ]
  );

  const replyResult = await RFQReply.collection.updateMany(
    {},
    [{
      $set: {
        selectedProducts: {
          $map: {
            input: { $ifNull: ["$selectedProducts", []] },
            as: "line",
            in: {
              $mergeObjects: [
                "$$line",
                {
                  tax: {
                    $ifNull: [
                      "$$line.tax",
                      { code: "$$line.hsnCode", rate: "$$line.gstRate", label: "GST" },
                    ],
                  },
                  adjustments: { $ifNull: ["$$line.adjustments", []] },
                },
              ],
            },
          },
        },
      },
    }]
  );

  console.log(
    `Generic catalog migration complete: ${organizations.length} settings profiles, ${scopedRfqs} RFQs scoped, ${scopedReplies} replies scoped, ${rfqResult.modifiedCount} RFQs, ${replyResult.modifiedCount} replies`
  );
  if (unresolvedRecords > 0) {
    console.warn(
      `Migration completed with ${unresolvedRecords} orphaned legacy records; assign them manually before exposing them in an organization.`
    );
  }
  process.exit(0);
}

migrateGenericProductsAndRfqs().catch((error) => {
  console.error("Generic catalog migration failed:", error);
  process.exit(1);
});
