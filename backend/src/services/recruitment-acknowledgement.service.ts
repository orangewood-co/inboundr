import React from "react";
import type { Types } from "mongoose";
import { RecruitmentApplicationAcknowledgement } from "../emails/recruitment-application-acknowledgement";
import { RecruitmentAcknowledgementDelivery } from "../models/recruitment-acknowledgement-delivery.model";
import { RecruitmentSettings } from "../models/recruitment-settings.model";
import { Organization } from "../models/organization.model";
import { sendEmail } from "../lib/email";

const LOCK_MS = Math.max(
  30_000,
  Number(process.env.RECRUITMENT_ACKNOWLEDGEMENT_LOCK_MS) || 5 * 60_000
);
const MAX_ATTEMPTS = Math.min(
  10,
  Math.max(1, Number(process.env.RECRUITMENT_ACKNOWLEDGEMENT_MAX_ATTEMPTS) || 5)
);

export async function queueRecruitmentAcknowledgement(input: {
  organizationId: Types.ObjectId;
  jobId: Types.ObjectId;
  applicationId: Types.ObjectId;
  applicationRevision: number;
  recipient: string;
  candidateName: string;
  jobTitle: string;
}): Promise<void> {
  await RecruitmentAcknowledgementDelivery.findOneAndUpdate(
    {
      applicationId: input.applicationId,
      applicationRevision: input.applicationRevision,
    },
    {
      $setOnInsert: {
        organizationId: input.organizationId,
        jobId: input.jobId,
        recipient: input.recipient,
        candidateName: input.candidateName,
        jobTitle: input.jobTitle,
        status: "queued",
        queuedAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function recoverStaleDeliveries() {
  await RecruitmentAcknowledgementDelivery.updateMany(
    {
      status: "sending",
      sendingAt: { $lt: new Date(Date.now() - LOCK_MS) },
    },
    {
      $set: {
        status: "queued",
        sendingAt: null,
        error: "Recovered stale sending lock",
      },
    }
  );
}

export async function processNextRecruitmentAcknowledgement() {
  await recoverStaleDeliveries();
  const claimed = await RecruitmentAcknowledgementDelivery.findOneAndUpdate(
    { status: "queued", attempts: { $lt: MAX_ATTEMPTS } },
    {
      $set: {
        status: "sending",
        sendingAt: new Date(),
        error: null,
      },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { queuedAt: 1, createdAt: 1 } }
  );
  if (!claimed) return null;

  try {
    const [organization, settings] = await Promise.all([
      Organization.findById(claimed.organizationId)
        .select("name logoUrl defaultContact.email preferences.primaryColor")
        .lean(),
      RecruitmentSettings.findOne({ organizationId: claimed.organizationId })
        .select("inheritOrganizationBranding branding")
        .lean(),
    ]);
    if (!organization) throw new Error("Organization not found");
    const inherit = settings?.inheritOrganizationBranding !== false;
    const logoUrl = inherit ? organization.logoUrl : settings?.branding?.logoUrl;
    const primaryColor =
      (inherit ? organization.preferences?.primaryColor : settings?.branding?.primaryColor) ||
      "#f5b400";
    const messageId = await sendEmail({
      to: claimed.recipient,
      subject: `Application received: ${claimed.jobTitle}`,
      replyTo: organization.defaultContact?.email
        ? [organization.defaultContact.email]
        : undefined,
      react: React.createElement(RecruitmentApplicationAcknowledgement, {
        candidateName: claimed.candidateName,
        organizationName: organization.name,
        jobTitle: claimed.jobTitle,
        logoUrl,
        primaryColor,
      }),
    });
    await RecruitmentAcknowledgementDelivery.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: "sent",
          messageId: messageId ?? null,
          sentAt: new Date(),
          failedAt: null,
          error: null,
        },
      }
    );
  } catch (error) {
    const retry = claimed.attempts < MAX_ATTEMPTS;
    await RecruitmentAcknowledgementDelivery.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: retry ? "queued" : "failed",
          failedAt: retry ? null : new Date(),
          sendingAt: null,
          messageId: null,
          error: error instanceof Error ? error.message.slice(0, 5000) : "Email delivery failed",
        },
      }
    );
  }
  return RecruitmentAcknowledgementDelivery.findById(claimed._id).lean();
}

let workerTimer: ReturnType<typeof setInterval> | null = null;
let workerBusy = false;

export function startRecruitmentAcknowledgementWorker() {
  if (
    workerTimer ||
    process.env.RECRUITMENT_ACKNOWLEDGEMENT_WORKER_ENABLED === "false"
  ) {
    return;
  }
  const tick = async () => {
    if (workerBusy) return;
    workerBusy = true;
    try {
      await processNextRecruitmentAcknowledgement();
    } catch (error) {
      console.error("Recruitment acknowledgement worker failed:", error);
    } finally {
      workerBusy = false;
    }
  };
  workerTimer = setInterval(
    tick,
    Math.max(
      2_000,
      Number(process.env.RECRUITMENT_ACKNOWLEDGEMENT_POLL_MS) || 10_000
    )
  );
  workerTimer.unref();
  void tick();
}
