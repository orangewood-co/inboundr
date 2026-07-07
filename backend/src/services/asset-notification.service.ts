import { createElement } from "react";
import type { Types } from "mongoose";
import { Employee } from "../models/employee.model";
import { Organization } from "../models/organization.model";
import { OrganizationMember } from "../models/organization-member.model";
import type { IAsset } from "../models/asset.model";
import {
  AssetAssignmentEmail,
  type AssetAssignmentEvent,
} from "../emails/asset-assignment";
import { frontendOrigin } from "../config/origins.config";
import { sendEmail } from "../lib/email";
import { createNotificationForRecipient } from "./notification.service";
import type { AssetActor } from "./asset.service";

function notificationContent(input: {
  event: AssetAssignmentEvent;
  actorName: string;
  assetName: string;
  assetCode: string;
  disposalType?: "sold" | "scrapped";
}): { subject: string; title: string; body: string } {
  const asset = `${input.assetName} (${input.assetCode})`;
  const actor = input.actorName.trim() || "A teammate";

  if (input.event === "assigned") {
    return {
      subject: `Asset assigned to you: ${asset}`,
      title: "Asset assigned to you",
      body: `${actor} assigned ${asset} to you.`,
    };
  }

  if (input.event === "unassigned") {
    return {
      subject: `Asset assignment removed: ${asset}`,
      title: "Asset assignment removed",
      body: `${asset} is no longer assigned to you.`,
    };
  }

  const disposal = input.disposalType === "sold" ? "sold" : "scrapped";
  return {
    subject: `Asset ${disposal}: ${asset}`,
    title: `Asset ${disposal}`,
    body: `${asset}, which was assigned to you, has been ${disposal}.`,
  };
}

/**
 * Emails the employee (always) and creates an in-app notification (when the
 * employee is linked to a platform member) about an assignment change.
 * Fire-and-forget: failures are logged and never fail the triggering action.
 */
export async function notifyAssetAssignmentChange(input: {
  organizationId: Types.ObjectId;
  asset: Pick<IAsset, "name" | "assetCode"> & { _id: unknown };
  employeeId: Types.ObjectId;
  event: AssetAssignmentEvent;
  disposalType?: "sold" | "scrapped";
  actor: AssetActor;
}): Promise<void> {
  try {
    const employee = await Employee.findOne({
      _id: input.employeeId,
      organizationId: input.organizationId,
    })
      .select("email fullName organizationMemberId")
      .lean();
    if (!employee?.email) return;

    const organization = await Organization.findById(input.organizationId)
      .select("name")
      .lean();
    const organizationName = organization?.name ?? "your organization";

    // Self-assignments stay silent.
    const actorEmail = (input.actor.email ?? "").trim().toLowerCase();
    if (actorEmail && employee.email.toLowerCase() === actorEmail) return;

    const assetId = String(input.asset._id);
    const content = notificationContent({
      event: input.event,
      actorName: input.actor.name,
      assetName: input.asset.name,
      assetCode: input.asset.assetCode,
      disposalType: input.disposalType,
    });

    await sendEmail({
      to: employee.email,
      subject: content.subject,
      react: createElement(AssetAssignmentEmail, {
        recipientName: employee.fullName,
        actorName: input.actor.name,
        organizationName,
        assetName: input.asset.name,
        assetCode: input.asset.assetCode,
        event: input.event,
        disposalType: input.disposalType,
        assetUrl: `${frontendOrigin}/assets/${assetId}`,
      }),
    }).catch((err) => {
      console.error("Failed to send asset assignment email:", err);
    });

    if (employee.organizationMemberId) {
      const member = await OrganizationMember.findOne({
        _id: employee.organizationMemberId,
        organizationId: input.organizationId,
      })
        .select("userId")
        .lean();

      if (member?.userId) {
        await createNotificationForRecipient({
          organizationId: input.organizationId,
          recipientUserId: member.userId,
          type: input.event === "assigned" ? "asset.assigned" : "asset.unassigned",
          title: content.title,
          body: content.body,
          actionUrl: `/assets/${assetId}`,
          actorUserId: input.actor.userId,
          entityType: "asset",
          entityId: assetId,
        });
      }
    }
  } catch (err) {
    console.error("Failed to notify asset assignment change:", err);
  }
}
