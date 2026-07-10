import type { Request, Response } from "express";
import mongoose from "mongoose";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import { Asset } from "../models/asset.model";
import { Customer } from "../models/customer.model";
import { CustomerSite } from "../models/customer-site.model";
import { InstalledEquipment } from "../models/installed-equipment.model";
import { ServiceActivity } from "../models/service-activity.model";
import { ServiceAttachment } from "../models/service-attachment.model";
import { ServiceManagementSettings } from "../models/service-management-settings.model";
import { ServiceRecord } from "../models/service-record.model";
import {
  SERVICE_PRIORITIES,
  SERVICE_REQUEST_TYPES,
  SERVICE_SYSTEM_CATEGORIES,
  ServiceRequest,
  type ServiceRequestType,
  type ServiceSystemCategory,
} from "../models/service-request.model";
import { Ticket } from "../models/ticket.model";
import {
  getServiceRelationSnapshots,
  getOrCreateServiceSettings,
  nextServiceReference,
  resolveServiceStatus,
  validateServiceRelations,
  writeServiceActivity,
} from "../services/service-management.service";
import {
  createPresignedUpload,
  createPresignedViewUrl,
  deleteObject,
  keyBelongsToPrefix,
} from "../services/storage.service";

function context(req: Request) {
  const orgReq = req as OrganizationRequest;
  return {
    organizationId: orgReq.organization._id,
    actorId: orgReq.user.id,
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableId(value: unknown): string | null {
  const normalized = text(value);
  return normalized || null;
}

function ids(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : [];
}

function validId(value: unknown): boolean {
  return mongoose.isValidObjectId(value);
}

function dateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const result = new Date(String(value));
  return Number.isNaN(result.getTime()) ? null : result;
}

function requestFilter(req: Request, organizationId: mongoose.Types.ObjectId) {
  const filter: Record<string, unknown> = { organizationId };
  const categories = text(req.query.systemCategory || req.query.status)
    .split(",")
    .filter((item) => SERVICE_SYSTEM_CATEGORIES.includes(item as ServiceSystemCategory));
  const priorities = text(req.query.priority)
    .split(",")
    .filter((item) => SERVICE_PRIORITIES.includes(item as any));
  if (categories.length) filter.systemCategory = { $in: categories };
  if (priorities.length) filter.priority = { $in: priorities };
  if (validId(req.query.customerId)) filter.customerId = req.query.customerId;
  if (validId(req.query.assignedEmployeeId)) filter.assignedEmployeeIds = req.query.assignedEmployeeId;
  if (validId(req.query.coordinatorId)) filter.coordinatorId = req.query.coordinatorId;
  if (validId(req.query.engineerId)) filter.engineerId = req.query.engineerId;
  if (validId(req.query.customerSiteId)) filter.customerSiteId = req.query.customerSiteId;
  if (validId(req.query.installedEquipmentId)) filter.installedEquipmentId = req.query.installedEquipmentId;
  if (text(req.query.complaintType)) filter.complaintType = text(req.query.complaintType);
  if (text(req.query.city)) {
    filter["siteSnapshot.city"] = {
      $regex: text(req.query.city).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {
      ...(req.query.from ? { $gte: new Date(String(req.query.from)) } : {}),
      ...(req.query.to ? { $lte: new Date(String(req.query.to)) } : {}),
    };
  }
  const search = text(req.query.search);
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { reference: { $regex: escaped, $options: "i" } },
      { title: { $regex: escaped, $options: "i" } },
      { description: { $regex: escaped, $options: "i" } },
      { "customerSnapshot.name": { $regex: escaped, $options: "i" } },
      { "customerSnapshot.company": { $regex: escaped, $options: "i" } },
      { "siteSnapshot.city": { $regex: escaped, $options: "i" } },
      { "equipmentSnapshot.serialNumber": { $regex: escaped, $options: "i" } },
    ];
  }
  return filter;
}

async function duplicateCandidates(input: {
  organizationId: mongoose.Types.ObjectId;
  customerId: string;
  title: string;
  installedEquipmentId?: string | null;
  excludeId?: string;
}) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const escaped = input.title.slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return ServiceRequest.find({
    organizationId: input.organizationId,
    _id: { $ne: input.excludeId },
    customerId: input.customerId,
    createdAt: { $gte: since },
    systemCategory: { $in: ["open", "waiting"] },
    $or: [
      ...(input.installedEquipmentId ? [{ installedEquipmentId: input.installedEquipmentId }] : []),
      ...(escaped ? [{ title: { $regex: escaped, $options: "i" } }] : []),
    ],
  })
    .select("reference title priority systemCategory createdAt")
    .limit(10)
    .lean();
}

export async function listServiceRequests(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const filter = requestFilter(req, organizationId);
    const [items, total] = await Promise.all([
      ServiceRequest.find(filter)
        .populate("customerId", "name company email")
        .populate("customerSiteId", "name address")
        .populate("installedEquipmentId", "name modelName serialNumber")
        .populate("assignedEmployeeIds", "fullName email")
        .populate("coordinatorId", "fullName email title")
        .populate("engineerId", "fullName email title")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ServiceRequest.countDocuments(filter),
    ]);
    res.json({ items, requests: items, page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) });
  } catch (error) {
    console.error("Failed to list service requests:", error);
    res.status(500).json({ error: "Failed to list service requests" });
  }
}

export async function createServiceRequest(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const customerId = text(req.body?.customerId);
    const title = text(req.body?.title);
    const assignedEmployeeIds = ids(req.body?.assignedEmployeeIds);
    const coordinatorId = nullableId(req.body?.coordinatorId);
    const engineerId = nullableId(req.body?.engineerId);
    if (!customerId || !title) {
      res.status(400).json({ error: "customerId and title are required" });
      return;
    }
    const validRelations = await validateServiceRelations({
      organizationId,
      customerId,
      customerSiteId: nullableId(req.body?.customerSiteId),
      installedEquipmentId: nullableId(req.body?.installedEquipmentId),
      assignedEmployeeIds,
      coordinatorId,
      engineerId,
    });
    if (!validRelations) {
      res.status(400).json({ error: "One or more customer, site, equipment, or employee references are invalid" });
      return;
    }
    const candidates = await duplicateCandidates({
      organizationId,
      customerId,
      title,
      installedEquipmentId: nullableId(req.body?.installedEquipmentId),
    });
    if (candidates.length && req.body?.allowDuplicate !== true) {
      res.status(409).json({
        error: "Potential duplicate service requests found",
        duplicateCandidates: candidates,
      });
      return;
    }
    const snapshots = await getServiceRelationSnapshots({
      organizationId,
      customerId,
      customerSiteId: nullableId(req.body?.customerSiteId),
      installedEquipmentId: nullableId(req.body?.installedEquipmentId),
    });
    if (!snapshots) {
      res.status(400).json({ error: "Unable to capture customer, site, or equipment snapshots" });
      return;
    }
    const priority = SERVICE_PRIORITIES.includes(req.body?.priority) ? req.body.priority : "medium";
    const status = await resolveServiceStatus(organizationId, text(req.body?.statusId) || undefined);
    const numbering = await nextServiceReference(organizationId, "service_request");
    const compatibilityAssignments = [...new Set([
      ...assignedEmployeeIds,
      ...(coordinatorId ? [coordinatorId] : []),
      ...(engineerId ? [engineerId] : []),
    ])];
    const item = await ServiceRequest.create({
      organizationId,
      ...numbering,
      type: "service_request",
      customerId,
      customerSiteId: nullableId(req.body?.customerSiteId),
      installedEquipmentId: nullableId(req.body?.installedEquipmentId),
      ...snapshots,
      title,
      description: text(req.body?.description),
      complaintType: text(req.body?.complaintType),
      priority,
      statusId: status.id,
      systemCategory: status.systemCategory,
      assignedEmployeeIds: compatibilityAssignments,
      coordinatorId,
      engineerId,
      dueAt: dateOrNull(req.body?.dueAt),
      sourceTicketId: null,
      createdBy: actorId,
      updatedBy: actorId,
    });
    await writeServiceActivity({
      organizationId,
      serviceRequestId: item._id,
      action: "created",
      message: `Created ${item.reference}`,
      actorId,
      metadata: { statusId: item.statusId, priority: item.priority },
    });
    res.status(201).json({ item, request: item, duplicateCandidates: candidates });
  } catch (error) {
    console.error("Failed to create service request:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create service request" });
  }
}

export async function getServiceRequest(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    const item = await ServiceRequest.findOne({ _id: req.params.id, organizationId })
      .populate("customerId")
      .populate("customerSiteId")
      .populate("installedEquipmentId")
      .populate("assignedEmployeeIds", "fullName email title")
      .populate("coordinatorId", "fullName email title")
      .populate("engineerId", "fullName email title")
      .lean();
    if (!item) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    const [activities, records, attachments, tickets] = await Promise.all([
      ServiceActivity.find({ organizationId, serviceRequestId: item._id }).sort({ createdAt: -1 }).lean(),
      ServiceRecord.find({ organizationId, serviceRequestId: item._id })
        .populate("assignedEmployeeIds", "fullName email")
        .sort({ createdAt: -1 })
        .lean(),
      ServiceAttachment.find({ organizationId, serviceRequestId: item._id }).sort({ createdAt: -1 }).lean(),
      Ticket.find({ organizationId, serviceRequestId: item._id }).select("ticketReference subject status priority channel").lean(),
    ]);
    const request = { ...item, activities, records, attachments, tickets };
    res.json({ item, request, activities, records, attachments, tickets });
  } catch (error) {
    console.error("Failed to get service request:", error);
    res.status(500).json({ error: "Failed to get service request" });
  }
}

export async function updateServiceRequest(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const item = await ServiceRequest.findOne({ _id: req.params.id, organizationId });
    if (!item) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    const customerId = text(req.body?.customerId) || String(item.customerId);
    const assignedEmployeeIds = req.body?.assignedEmployeeIds === undefined
      ? item.assignedEmployeeIds.map(String)
      : ids(req.body.assignedEmployeeIds);
    const coordinatorId = req.body?.coordinatorId === undefined
      ? item.coordinatorId?.toString() ?? null
      : nullableId(req.body.coordinatorId);
    const engineerId = req.body?.engineerId === undefined
      ? item.engineerId?.toString() ?? null
      : nullableId(req.body.engineerId);
    if (!(await validateServiceRelations({
      organizationId,
      customerId,
      customerSiteId: req.body?.customerSiteId === undefined ? item.customerSiteId?.toString() : nullableId(req.body.customerSiteId),
      installedEquipmentId: req.body?.installedEquipmentId === undefined ? item.installedEquipmentId?.toString() : nullableId(req.body.installedEquipmentId),
      assignedEmployeeIds,
      coordinatorId,
      engineerId,
    }))) {
      res.status(400).json({ error: "One or more related records are invalid" });
      return;
    }
    const before = item.toObject();
    if (req.body?.title !== undefined) item.title = text(req.body.title);
    if (req.body?.description !== undefined) item.description = text(req.body.description);
    if (req.body?.complaintType !== undefined) item.complaintType = text(req.body.complaintType);
    if (SERVICE_PRIORITIES.includes(req.body?.priority)) item.priority = req.body.priority;
    item.customerId = new mongoose.Types.ObjectId(customerId);
    item.customerSiteId = nullableId(req.body?.customerSiteId) as any ?? (req.body?.customerSiteId === null ? null : item.customerSiteId);
    item.installedEquipmentId = nullableId(req.body?.installedEquipmentId) as any ?? (req.body?.installedEquipmentId === null ? null : item.installedEquipmentId);
    const compatibilityAssignments = [...new Set([
      ...assignedEmployeeIds,
      ...(coordinatorId ? [coordinatorId] : []),
      ...(engineerId ? [engineerId] : []),
    ])];
    item.assignedEmployeeIds = compatibilityAssignments.map((id) => new mongoose.Types.ObjectId(id));
    item.coordinatorId = coordinatorId ? new mongoose.Types.ObjectId(coordinatorId) : null;
    item.engineerId = engineerId ? new mongoose.Types.ObjectId(engineerId) : null;
    if (req.body?.dueAt !== undefined) item.dueAt = dateOrNull(req.body.dueAt);
    item.updatedBy = actorId;
    await item.save();
    await writeServiceActivity({
      organizationId,
      serviceRequestId: item._id,
      action: "updated",
      message: "Service request details updated",
      actorId,
      metadata: { before: { title: before.title, priority: before.priority }, after: { title: item.title, priority: item.priority } },
    });
    res.json({ item });
  } catch (error) {
    console.error("Failed to update service request:", error);
    res.status(500).json({ error: "Failed to update service request" });
  }
}

export async function deleteServiceRequest(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const item = await ServiceRequest.findOne({ _id: req.params.id, organizationId });
    if (!item) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    if (item.systemCategory !== "cancelled") {
      res.status(409).json({ error: "Only cancelled service requests can be deleted" });
      return;
    }
    await writeServiceActivity({
      organizationId,
      serviceRequestId: item._id,
      action: "deleted",
      message: `Deleted ${item.reference}`,
      actorId,
    });
    const attachments = await ServiceAttachment.find({ organizationId, serviceRequestId: item._id }).lean();
    await Promise.all(attachments.map((attachment) => deleteObject(attachment.key).catch(() => undefined)));
    await Promise.all([
      ServiceAttachment.deleteMany({ organizationId, serviceRequestId: item._id }),
      ServiceRecord.deleteMany({ organizationId, serviceRequestId: item._id }),
      Ticket.updateMany({ organizationId, serviceRequestId: item._id }, { $set: { serviceRequestId: null } }),
      item.deleteOne(),
    ]);
    res.status(204).end();
  } catch (error) {
    console.error("Failed to delete service request:", error);
    res.status(500).json({ error: "Failed to delete service request" });
  }
}

export async function assignServiceRequest(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const item = await ServiceRequest.findOne({ _id: req.params.id, organizationId });
    const assignedEmployeeIds = req.body?.assignedEmployeeIds === undefined
      ? item?.assignedEmployeeIds.map(String) ?? []
      : ids(req.body.assignedEmployeeIds);
    const coordinatorId = req.body?.coordinatorId === undefined
      ? item?.coordinatorId?.toString() ?? null
      : nullableId(req.body.coordinatorId);
    const engineerId = req.body?.engineerId === undefined
      ? item?.engineerId?.toString() ?? null
      : nullableId(req.body.engineerId);
    if (!item) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    if (!(await validateServiceRelations({
      organizationId,
      customerId: String(item.customerId),
      customerSiteId: item.customerSiteId?.toString(),
      installedEquipmentId: item.installedEquipmentId?.toString(),
      assignedEmployeeIds,
      coordinatorId,
      engineerId,
    }))) {
      res.status(400).json({ error: "Invalid employee assignment" });
      return;
    }
    const previous = {
      assignedEmployeeIds: item.assignedEmployeeIds.map(String),
      coordinatorId: item.coordinatorId?.toString() ?? null,
      engineerId: item.engineerId?.toString() ?? null,
    };
    const compatibilityAssignments = [...new Set([
      ...assignedEmployeeIds,
      ...(coordinatorId ? [coordinatorId] : []),
      ...(engineerId ? [engineerId] : []),
    ])];
    item.assignedEmployeeIds = compatibilityAssignments.map((id) => new mongoose.Types.ObjectId(id));
    item.coordinatorId = coordinatorId ? new mongoose.Types.ObjectId(coordinatorId) : null;
    item.engineerId = engineerId ? new mongoose.Types.ObjectId(engineerId) : null;
    item.updatedBy = actorId;
    await item.save();
    await writeServiceActivity({
      organizationId,
      serviceRequestId: item._id,
      action: "assigned",
      message: "Assignment updated",
      actorId,
      metadata: { previous, assignedEmployeeIds: compatibilityAssignments, coordinatorId, engineerId },
    });
    res.json({ item });
  } catch (error) {
    console.error("Failed to assign service request:", error);
    res.status(500).json({ error: "Failed to assign service request" });
  }
}

export async function changeServiceStatus(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const item = await ServiceRequest.findOne({ _id: req.params.id, organizationId });
    if (!item) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    const status = await resolveServiceStatus(organizationId, text(req.body?.statusId));
    if (status.systemCategory === "closed") {
      res.status(400).json({ error: "Use the closure endpoint to close a service request" });
      return;
    }
    if (["resolved", "closed", "cancelled"].includes(item.systemCategory) &&
        status.systemCategory !== item.systemCategory) {
      res.status(409).json({ error: "Use the reopen endpoint to leave a terminal status" });
      return;
    }
    const previous = { statusId: item.statusId, systemCategory: item.systemCategory };
    item.statusId = status.id;
    item.systemCategory = status.systemCategory;
    item.resolvedAt = status.systemCategory === "resolved" ? new Date() : item.resolvedAt;
    item.cancelledAt = status.systemCategory === "cancelled" ? new Date() : null;
    item.updatedBy = actorId;
    await item.save();
    await writeServiceActivity({
      organizationId,
      serviceRequestId: item._id,
      action: "status_changed",
      message: `Status changed to ${status.label}`,
      actorId,
      metadata: { previous, current: { statusId: status.id, systemCategory: status.systemCategory } },
    });
    res.json({ item });
  } catch (error) {
    console.error("Failed to change service status:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to change status" });
  }
}

export async function closeServiceRequest(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const confirmedByCustomer = req.body?.confirmedByCustomer === true;
    const waiverReason = text(req.body?.waiverReason);
    if (!confirmedByCustomer && !waiverReason) {
      res.status(400).json({ error: "Customer confirmation or a waiver reason is required" });
      return;
    }
    const item = await ServiceRequest.findOne({ _id: req.params.id, organizationId });
    if (!item) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    if (item.systemCategory === "cancelled") {
      res.status(409).json({ error: "Reopen a cancelled service request before closing it" });
      return;
    }
    const status = await resolveServiceStatus(organizationId, text(req.body?.statusId) || undefined, "closed");
    const now = new Date();
    item.statusId = status.id;
    item.systemCategory = "closed";
    item.closedAt = now;
    item.closure = {
      confirmedByCustomer,
      confirmationNote: text(req.body?.confirmationNote),
      waiverReason,
      closedBy: actorId,
      closedAt: now,
    };
    item.updatedBy = actorId;
    await item.save();
    await writeServiceActivity({
      organizationId,
      serviceRequestId: item._id,
      action: "closed",
      message: confirmedByCustomer ? "Closed with customer confirmation" : "Closed with confirmation waiver",
      actorId,
      metadata: { confirmedByCustomer, waiverReason },
    });
    res.json({ item });
  } catch (error) {
    console.error("Failed to close service request:", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to close service request" });
  }
}

export async function reopenServiceRequest(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const item = await ServiceRequest.findOne({ _id: req.params.id, organizationId });
    if (!item) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    if (!["closed", "resolved", "cancelled"].includes(item.systemCategory)) {
      res.status(409).json({ error: "Only resolved, closed, or cancelled requests can be reopened" });
      return;
    }
    const status = await resolveServiceStatus(organizationId, text(req.body?.statusId) || undefined, "open");
    item.statusId = status.id;
    item.systemCategory = "open";
    item.closedAt = null;
    item.cancelledAt = null;
    item.reopenedCount += 1;
    item.updatedBy = actorId;
    await item.save();
    await writeServiceActivity({
      organizationId,
      serviceRequestId: item._id,
      action: "reopened",
      message: text(req.body?.reason) || "Service request reopened",
      actorId,
      metadata: { reopenedCount: item.reopenedCount },
    });
    res.json({ item });
  } catch (error) {
    console.error("Failed to reopen service request:", error);
    res.status(500).json({ error: "Failed to reopen service request" });
  }
}

export async function addServiceActivity(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const item = await ServiceRequest.findOne({ _id: req.params.id, organizationId }).select("_id");
    if (!item) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    const activity = await writeServiceActivity({
      organizationId,
      serviceRequestId: item._id,
      action: text(req.body?.action) || "note_added",
      message: text(req.body?.message),
      actorId,
      metadata: typeof req.body?.metadata === "object" && req.body.metadata ? req.body.metadata : {},
    });
    res.status(201).json({ activity });
  } catch (error) {
    console.error("Failed to add service activity:", error);
    res.status(500).json({ error: "Failed to add service activity" });
  }
}

export async function listServiceActivities(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    if (!(await ServiceRequest.exists({ _id: req.params.id, organizationId }))) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    const items = await ServiceActivity.find({
      organizationId,
      serviceRequestId: req.params.id,
    }).sort({ createdAt: -1 }).lean();
    res.json({ items });
  } catch {
    res.status(500).json({ error: "Failed to list service activities" });
  }
}

export async function listServiceRecords(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    if (!(await ServiceRequest.exists({ _id: req.params.id, organizationId }))) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    const items = await ServiceRecord.find({
      organizationId,
      serviceRequestId: req.params.id,
    }).populate("assignedEmployeeIds", "fullName email").sort({ createdAt: -1 }).lean();
    res.json({ items });
  } catch {
    res.status(500).json({ error: "Failed to list service records" });
  }
}

export async function getServiceRecord(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    const item = await ServiceRecord.findOne({
      _id: req.params.recordId,
      serviceRequestId: req.params.id,
      organizationId,
    }).populate("assignedEmployeeIds", "fullName email").lean();
    if (!item) {
      res.status(404).json({ error: "Service record not found" });
      return;
    }
    const attachments = await ServiceAttachment.find({
      organizationId,
      serviceRequestId: req.params.id,
      serviceRecordId: item._id,
    }).sort({ createdAt: -1 }).lean();
    res.json({ item, attachments });
  } catch {
    res.status(500).json({ error: "Failed to get service record" });
  }
}

export async function createServiceRecord(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const parent = await ServiceRequest.findOne({ _id: req.params.id, organizationId });
    if (!parent) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    const type = text(req.body?.type) as ServiceRequestType;
    if (!SERVICE_REQUEST_TYPES.includes(type) || type === "service_request") {
      res.status(400).json({ error: "type must be service_visit, spare_dispatch, or root_cause_analysis" });
      return;
    }
    const title = text(req.body?.title);
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const assignedEmployeeIds = ids(req.body?.assignedEmployeeIds);
    if (!(await validateServiceRelations({
      organizationId,
      customerId: String(parent.customerId),
      customerSiteId: parent.customerSiteId?.toString(),
      installedEquipmentId: parent.installedEquipmentId?.toString(),
      assignedEmployeeIds,
    }))) {
      res.status(400).json({ error: "Invalid employee assignment" });
      return;
    }
    const status = await resolveServiceStatus(organizationId, text(req.body?.statusId) || undefined);
    const numbering = await nextServiceReference(organizationId, type);
    const record = await ServiceRecord.create({
      organizationId,
      serviceRequestId: parent._id,
      ...numbering,
      type,
      title,
      description: text(req.body?.description),
      statusId: status.id,
      systemCategory: status.systemCategory,
      assignedEmployeeIds,
      scheduledAt: dateOrNull(req.body?.scheduledAt),
      completedAt: dateOrNull(req.body?.completedAt),
      createdBy: actorId,
      updatedBy: actorId,
    });
    await writeServiceActivity({
      organizationId,
      serviceRequestId: parent._id,
      serviceRecordId: record._id,
      action: "record_created",
      message: `Created ${record.reference}`,
      actorId,
      metadata: { type },
    });
    res.status(201).json({ record });
  } catch (error) {
    console.error("Failed to create service record:", error);
    res.status(500).json({ error: "Failed to create service record" });
  }
}

export async function updateServiceRecord(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const record = await ServiceRecord.findOne({
      _id: req.params.recordId,
      serviceRequestId: req.params.id,
      organizationId,
    });
    if (!record) {
      res.status(404).json({ error: "Service record not found" });
      return;
    }
    if (req.body?.title !== undefined) record.title = text(req.body.title);
    if (req.body?.description !== undefined) record.description = text(req.body.description);
    if (req.body?.assignedEmployeeIds !== undefined) {
      const parent = await ServiceRequest.findOne({ _id: record.serviceRequestId, organizationId });
      const assignedEmployeeIds = ids(req.body.assignedEmployeeIds);
      if (!parent || !(await validateServiceRelations({
        organizationId,
        customerId: String(parent.customerId),
        customerSiteId: parent.customerSiteId?.toString(),
        installedEquipmentId: parent.installedEquipmentId?.toString(),
        assignedEmployeeIds,
      }))) {
        res.status(400).json({ error: "Invalid employee assignment" });
        return;
      }
      record.assignedEmployeeIds = assignedEmployeeIds.map((id) => new mongoose.Types.ObjectId(id));
    }
    if (req.body?.scheduledAt !== undefined) record.scheduledAt = dateOrNull(req.body.scheduledAt);
    if (req.body?.completedAt !== undefined) record.completedAt = dateOrNull(req.body.completedAt);
    if (req.body?.statusId !== undefined) {
      const status = await resolveServiceStatus(organizationId, text(req.body.statusId));
      record.statusId = status.id;
      record.systemCategory = status.systemCategory;
    }
    record.updatedBy = actorId;
    await record.save();
    await writeServiceActivity({
      organizationId,
      serviceRequestId: record.serviceRequestId,
      serviceRecordId: record._id,
      action: "record_updated",
      message: `Updated ${record.reference}`,
      actorId,
    });
    res.json({ record });
  } catch (error) {
    console.error("Failed to update service record:", error);
    res.status(500).json({ error: "Failed to update service record" });
  }
}

export async function deleteServiceRecord(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const record = await ServiceRecord.findOne({
      _id: req.params.recordId,
      serviceRequestId: req.params.id,
      organizationId,
    });
    if (!record) {
      res.status(404).json({ error: "Service record not found" });
      return;
    }
    await writeServiceActivity({
      organizationId,
      serviceRequestId: record.serviceRequestId,
      serviceRecordId: record._id,
      action: "record_deleted",
      message: `Deleted ${record.reference}`,
      actorId,
    });
    await record.deleteOne();
    res.status(204).end();
  } catch (error) {
    console.error("Failed to delete service record:", error);
    res.status(500).json({ error: "Failed to delete service record" });
  }
}

export async function presignServiceAttachment(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    const item = await ServiceRequest.exists({ _id: req.params.id, organizationId });
    const fileName = text(req.body?.fileName);
    const contentType = text(req.body?.contentType);
    const size = Number(req.body?.size);
    if (!item) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    if (!fileName || !contentType || !Number.isFinite(size) || size < 1 || size > 50 * 1024 * 1024) {
      res.status(400).json({ error: "Valid fileName, contentType, and size (max 50 MB) are required" });
      return;
    }
    res.json(await createPresignedUpload({
      scope: "service-management",
      organizationId: String(organizationId),
      fileName,
      contentType,
      size,
      prefixParts: [String(req.params.id)],
    }));
  } catch (error) {
    console.error("Failed to presign service attachment:", error);
    res.status(500).json({ error: "Failed to create upload URL" });
  }
}

export async function listServiceAttachments(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    if (!(await ServiceRequest.exists({ _id: req.params.id, organizationId }))) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    const filter: Record<string, unknown> = {
      organizationId,
      serviceRequestId: req.params.id,
    };
    if (validId(req.query.serviceRecordId)) filter.serviceRecordId = req.query.serviceRecordId;
    res.json({ items: await ServiceAttachment.find(filter).sort({ createdAt: -1 }).lean() });
  } catch {
    res.status(500).json({ error: "Failed to list service attachments" });
  }
}

export async function createServiceAttachment(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const item = await ServiceRequest.findOne({ _id: req.params.id, organizationId }).select("_id");
    const key = text(req.body?.key);
    if (!item) {
      res.status(404).json({ error: "Service request not found" });
      return;
    }
    if (!keyBelongsToPrefix(key, ["service-management", String(organizationId), String(item._id)])) {
      res.status(400).json({ error: "Attachment key is outside this service request" });
      return;
    }
    const serviceRecordId = nullableId(req.body?.serviceRecordId);
    if (serviceRecordId && !(await ServiceRecord.exists({
      _id: serviceRecordId,
      serviceRequestId: item._id,
      organizationId,
    }))) {
      res.status(400).json({ error: "Service record does not belong to this request" });
      return;
    }
    const serviceActivityId = nullableId(req.body?.serviceActivityId);
    if (serviceActivityId && !(await ServiceActivity.exists({
      _id: serviceActivityId,
      serviceRequestId: item._id,
      organizationId,
    }))) {
      res.status(400).json({ error: "Service activity does not belong to this request" });
      return;
    }
    const attachment = await ServiceAttachment.create({
      organizationId,
      serviceRequestId: item._id,
      serviceRecordId,
      serviceActivityId,
      key,
      bucket: text(req.body?.bucket),
      originalName: text(req.body?.originalName),
      contentType: text(req.body?.contentType),
      size: Number(req.body?.size) || 0,
      description: text(req.body?.description),
      uploadedBy: actorId,
    });
    const activity = await writeServiceActivity({
      organizationId,
      serviceRequestId: item._id,
      action: "attachment_added",
      message: `Attached ${attachment.originalName}`,
      actorId,
      metadata: { attachmentId: attachment._id, size: attachment.size },
    });
    if (!attachment.serviceActivityId) {
      attachment.serviceActivityId = activity._id;
      await attachment.save();
    }
    res.status(201).json({ attachment });
  } catch (error) {
    console.error("Failed to create service attachment:", error);
    res.status(500).json({ error: "Failed to save attachment metadata" });
  }
}

export async function viewServiceAttachment(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    const attachment = await ServiceAttachment.findOne({
      _id: req.params.attachmentId,
      serviceRequestId: req.params.id,
      organizationId,
    }).lean();
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    const download = req.query.download === "1" || req.query.download === "true";
    res.json(await createPresignedViewUrl(
      attachment.key,
      download ? { downloadFileName: attachment.originalName } : {}
    ));
  } catch (error) {
    console.error("Failed to view service attachment:", error);
    res.status(500).json({ error: "Failed to create attachment URL" });
  }
}

export async function deleteServiceAttachment(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const attachment = await ServiceAttachment.findOne({
      _id: req.params.attachmentId,
      serviceRequestId: req.params.id,
      organizationId,
    });
    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }
    await deleteObject(attachment.key);
    await attachment.deleteOne();
    await writeServiceActivity({
      organizationId,
      serviceRequestId: attachment.serviceRequestId,
      action: "attachment_deleted",
      message: `Deleted attachment ${attachment.originalName}`,
      actorId,
      metadata: { attachmentId: attachment._id },
    });
    res.status(204).end();
  } catch (error) {
    console.error("Failed to delete service attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
}

export async function getServiceSettings(req: Request, res: Response): Promise<void> {
  try {
    const settings = await getOrCreateServiceSettings(context(req).organizationId);
    res.json({
      settings,
      fiscalYearStartMonth: settings.fiscalYearStartMonth,
      numberPadding: settings.numberPadding,
      prefixes: settings.prefixes,
      statuses: settings.statuses,
    });
  } catch (error) {
    console.error("Failed to get service settings:", error);
    res.status(500).json({ error: "Failed to get service settings" });
  }
}

export async function updateServiceSettings(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const current = await getOrCreateServiceSettings(organizationId);
    const fiscalYearStartMonth = Number(req.body?.fiscalYearStartMonth ?? current.fiscalYearStartMonth);
    const numberPadding = Number(req.body?.numberPadding ?? current.numberPadding);
    if (fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12 || numberPadding < 1 || numberPadding > 10) {
      res.status(400).json({ error: "Invalid fiscal year start month or number padding" });
      return;
    }
    const statuses = Array.isArray(req.body?.statuses) ? req.body.statuses : current.statuses;
    const activeStatuses = statuses.filter((status: any) =>
      text(status?.id) && text(status?.label) && SERVICE_SYSTEM_CATEGORIES.includes(status.systemCategory)
    );
    const defaultCount = activeStatuses.filter(
      (status: any) => status.isDefault && status.isActive !== false
    ).length;
    if (!activeStatuses.length || defaultCount !== 1) {
      res.status(400).json({ error: "Exactly one active default status is required" });
      return;
    }
    const rawPrefixes = req.body?.prefixes ?? {};
    const normalizePrefix = (value: unknown, fallback: string) =>
      (text(value) || fallback).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
    const settings = await ServiceManagementSettings.findOneAndUpdate(
      { organizationId },
      {
        $set: {
          fiscalYearStartMonth,
          numberPadding,
          prefixes: {
            serviceRequest: normalizePrefix(rawPrefixes.serviceRequest, current.prefixes.serviceRequest),
            serviceVisit: normalizePrefix(rawPrefixes.serviceVisit, current.prefixes.serviceVisit),
            spareDispatch: normalizePrefix(
              rawPrefixes.spareDispatch,
              current.prefixes.spareDispatch
            ),
            rootCauseAnalysis: normalizePrefix(rawPrefixes.rootCauseAnalysis, current.prefixes.rootCauseAnalysis),
          },
          statuses: activeStatuses,
        },
      },
      { new: true }
    );
    await writeServiceActivity({
      organizationId,
      action: "settings_updated",
      message: "Service management workflow settings updated",
      actorId,
      metadata: { fiscalYearStartMonth, numberPadding },
    });
    res.json({
      settings,
      fiscalYearStartMonth: settings?.fiscalYearStartMonth,
      numberPadding: settings?.numberPadding,
      prefixes: settings?.prefixes,
      statuses: settings?.statuses,
    });
  } catch (error) {
    console.error("Failed to update service settings:", error);
    res.status(500).json({ error: "Failed to update service settings" });
  }
}

export async function serviceSummary(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    const filter = requestFilter(req, organizationId);
    if (!req.query.systemCategory && !req.query.status) {
      filter.systemCategory = { $in: ["open", "waiting"] };
    }
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const [total, byStatus, byPriority, overdue, rows] = await Promise.all([
      ServiceRequest.countDocuments(filter),
      ServiceRequest.aggregate([{ $match: filter }, { $group: { _id: "$systemCategory", count: { $sum: 1 } } }]),
      ServiceRequest.aggregate([{ $match: filter }, { $group: { _id: "$priority", count: { $sum: 1 } } }]),
      ServiceRequest.countDocuments({
        ...filter,
        dueAt: { $lt: new Date() },
        systemCategory: { $in: ["open", "waiting"] },
      }),
      ServiceRequest.find(filter)
        .populate("customerId", "name company email")
        .populate("customerSiteId", "name address city state postalCode country")
        .populate("installedEquipmentId", "name modelName serialNumber")
        .populate("coordinatorId", "fullName email title")
        .populate("engineerId", "fullName email title")
        .sort({ lastActivityAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
    res.json({
      requests: rows,
      rows,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      overdue,
      byStatus,
      byPriority,
    });
  } catch (error) {
    console.error("Failed to get service summary:", error);
    res.status(500).json({ error: "Failed to get service summary" });
  }
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
}

export async function exportServiceRequests(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    const items = await ServiceRequest.find(requestFilter(req, organizationId))
      .populate("coordinatorId", "fullName email")
      .populate("engineerId", "fullName email")
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();
    const rows = [
      [
        "Reference",
        "Title",
        "Customer",
        "Company",
        "Site",
        "City",
        "Equipment",
        "Equipment Model",
        "Serial Number",
        "Complaint Type",
        "Coordinator",
        "Engineer",
        "Priority",
        "Status",
        "Created",
        "Due",
      ],
      ...items.map((item: any) => [
        item.reference,
        item.title,
        item.customerSnapshot?.name || "",
        item.customerSnapshot?.company || "",
        item.siteSnapshot?.name || "",
        item.siteSnapshot?.city || "",
        item.equipmentSnapshot?.name || "",
        item.equipmentSnapshot?.modelName || "",
        item.equipmentSnapshot?.serialNumber || "",
        item.complaintType || "",
        item.coordinatorId?.fullName || "",
        item.engineerId?.fullName || "",
        item.priority,
        item.systemCategory,
        item.createdAt?.toISOString?.() ?? "",
        item.dueAt?.toISOString?.() ?? "",
      ]),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="service-requests-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(rows.map((row) => row.map(csvCell).join(",")).join("\n"));
  } catch (error) {
    console.error("Failed to export service requests:", error);
    res.status(500).json({ error: "Failed to export service requests" });
  }
}

export async function listCustomerSites(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    const filter: Record<string, unknown> = { organizationId };
    if (validId(req.query.customerId)) filter.customerId = req.query.customerId;
    if (req.query.includeArchived !== "true") filter.isArchived = false;
    res.json({ items: await CustomerSite.find(filter).sort({ name: 1 }).lean() });
  } catch {
    res.status(500).json({ error: "Failed to list customer sites" });
  }
}

export async function getCustomerSite(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    const item = await CustomerSite.findOne({ _id: req.params.siteId, organizationId }).lean();
    if (!item) {
      res.status(404).json({ error: "Customer site not found" });
      return;
    }
    res.json({ item });
  } catch {
    res.status(500).json({ error: "Failed to get customer site" });
  }
}

export async function createCustomerSite(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const customerId = text(req.body?.customerId);
    if (!text(req.body?.name) || !(await Customer.exists({ _id: customerId, organizationId }))) {
      res.status(400).json({ error: "Valid customerId and name are required" });
      return;
    }
    const item = await CustomerSite.create({
      organizationId,
      customerId,
      name: text(req.body.name),
      address: text(req.body.address),
      city: text(req.body.city),
      state: text(req.body.state),
      postalCode: text(req.body.postalCode),
      country: text(req.body.country),
      contactName: text(req.body.contactName),
      contactEmail: text(req.body.contactEmail),
      contactPhone: text(req.body.contactPhone),
      notes: text(req.body.notes),
    });
    await writeServiceActivity({
      organizationId,
      action: "customer_site_created",
      message: `Created customer site ${item.name}`,
      actorId,
      metadata: { customerSiteId: item._id, customerId: item.customerId },
    });
    res.status(201).json({ item });
  } catch {
    res.status(500).json({ error: "Failed to create customer site" });
  }
}

export async function updateCustomerSite(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const item = await CustomerSite.findOneAndUpdate(
      { _id: req.params.siteId, organizationId },
      { $set: {
        ...(req.body?.name !== undefined ? { name: text(req.body.name) } : {}),
        ...(req.body?.address !== undefined ? { address: text(req.body.address) } : {}),
        ...(req.body?.city !== undefined ? { city: text(req.body.city) } : {}),
        ...(req.body?.state !== undefined ? { state: text(req.body.state) } : {}),
        ...(req.body?.postalCode !== undefined ? { postalCode: text(req.body.postalCode) } : {}),
        ...(req.body?.country !== undefined ? { country: text(req.body.country) } : {}),
        ...(req.body?.contactName !== undefined ? { contactName: text(req.body.contactName) } : {}),
        ...(req.body?.contactEmail !== undefined ? { contactEmail: text(req.body.contactEmail) } : {}),
        ...(req.body?.contactPhone !== undefined ? { contactPhone: text(req.body.contactPhone) } : {}),
        ...(req.body?.notes !== undefined ? { notes: text(req.body.notes) } : {}),
        ...(typeof req.body?.isArchived === "boolean" ? { isArchived: req.body.isArchived } : {}),
      } },
      { new: true, runValidators: true }
    );
    if (!item) {
      res.status(404).json({ error: "Customer site not found" });
      return;
    }
    await writeServiceActivity({
      organizationId,
      action: "customer_site_updated",
      message: `Updated customer site ${item.name}`,
      actorId,
      metadata: { customerSiteId: item._id, customerId: item.customerId },
    });
    res.json({ item });
  } catch {
    res.status(500).json({ error: "Failed to update customer site" });
  }
}

export async function deleteCustomerSite(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const inUse = await ServiceRequest.exists({ organizationId, customerSiteId: req.params.siteId });
    if (inUse) {
      res.status(409).json({ error: "Archive this site because it is referenced by service requests" });
      return;
    }
    const item = await CustomerSite.findOneAndDelete({ _id: req.params.siteId, organizationId });
    if (!item) {
      res.status(404).json({ error: "Customer site not found" });
      return;
    }
    await writeServiceActivity({
      organizationId,
      action: "customer_site_deleted",
      message: `Deleted customer site ${item.name}`,
      actorId,
      metadata: { customerSiteId: item._id, customerId: item.customerId },
    });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete customer site" });
  }
}

export async function listInstalledEquipment(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    const filter: Record<string, unknown> = { organizationId };
    if (validId(req.query.customerId)) filter.customerId = req.query.customerId;
    if (validId(req.query.customerSiteId)) filter.customerSiteId = req.query.customerSiteId;
    if (req.query.includeArchived !== "true") filter.isArchived = false;
    res.json({
      items: await InstalledEquipment.find(filter)
        .populate("customerSiteId", "name")
        .populate("assetId", "assetCode name")
        .sort({ name: 1 })
        .lean(),
    });
  } catch {
    res.status(500).json({ error: "Failed to list installed equipment" });
  }
}

export async function getInstalledEquipment(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = context(req);
    const item = await InstalledEquipment.findOne({
      _id: req.params.equipmentId,
      organizationId,
    }).populate("customerId", "name company").populate("customerSiteId", "name address")
      .populate("assetId", "assetCode name").lean();
    if (!item) {
      res.status(404).json({ error: "Installed equipment not found" });
      return;
    }
    res.json({ item });
  } catch {
    res.status(500).json({ error: "Failed to get installed equipment" });
  }
}

async function validEquipmentRelations(organizationId: mongoose.Types.ObjectId, body: any): Promise<boolean> {
  const customerId = text(body?.customerId);
  const siteId = nullableId(body?.customerSiteId);
  const assetId = nullableId(body?.assetId);
  const [customer, site, asset] = await Promise.all([
    Customer.exists({ _id: customerId, organizationId }),
    siteId ? CustomerSite.exists({ _id: siteId, customerId, organizationId }) : true,
    assetId ? Asset.exists({ _id: assetId, organizationId }) : true,
  ]);
  return Boolean(customer && site && asset);
}

export async function createInstalledEquipment(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    if (!text(req.body?.name) || !(await validEquipmentRelations(organizationId, req.body))) {
      res.status(400).json({ error: "Valid customer, site, asset, and name are required" });
      return;
    }
    const item = await InstalledEquipment.create({
      organizationId,
      customerId: text(req.body.customerId),
      customerSiteId: nullableId(req.body.customerSiteId),
      assetId: nullableId(req.body.assetId),
      name: text(req.body.name),
      modelName: text(req.body.modelName ?? req.body.model),
      serialNumber: text(req.body.serialNumber),
      manufacturer: text(req.body.manufacturer),
      installedAt: dateOrNull(req.body.installedAt),
      warrantyExpiresAt: dateOrNull(req.body.warrantyExpiresAt),
      notes: text(req.body.notes),
    });
    await writeServiceActivity({
      organizationId,
      action: "installed_equipment_created",
      message: `Created installed equipment ${item.name}`,
      actorId,
      metadata: { installedEquipmentId: item._id, customerId: item.customerId },
    });
    res.status(201).json({ item });
  } catch (error: any) {
    res.status(error?.code === 11000 ? 409 : 500).json({ error: error?.code === 11000 ? "Serial number already exists" : "Failed to create installed equipment" });
  }
}

export async function updateInstalledEquipment(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const current = await InstalledEquipment.findOne({ _id: req.params.equipmentId, organizationId });
    if (!current) {
      res.status(404).json({ error: "Installed equipment not found" });
      return;
    }
    const merged = {
      ...current.toObject(),
      ...req.body,
      customerId: req.body?.customerId ?? String(current.customerId),
      customerSiteId: req.body?.customerSiteId ?? current.customerSiteId,
      assetId: req.body?.assetId ?? current.assetId,
    };
    if (!(await validEquipmentRelations(organizationId, merged))) {
      res.status(400).json({ error: "Invalid customer, site, or asset" });
      return;
    }
    const item = await InstalledEquipment.findByIdAndUpdate(current._id, {
      $set: {
        customerId: merged.customerId,
        customerSiteId: nullableId(merged.customerSiteId),
        assetId: nullableId(merged.assetId),
        ...(req.body?.name !== undefined ? { name: text(req.body.name) } : {}),
        ...(req.body?.modelName !== undefined || req.body?.model !== undefined
          ? { modelName: text(req.body.modelName ?? req.body.model) }
          : {}),
        ...(req.body?.serialNumber !== undefined ? { serialNumber: text(req.body.serialNumber) } : {}),
        ...(req.body?.manufacturer !== undefined ? { manufacturer: text(req.body.manufacturer) } : {}),
        ...(req.body?.installedAt !== undefined ? { installedAt: dateOrNull(req.body.installedAt) } : {}),
        ...(req.body?.warrantyExpiresAt !== undefined ? { warrantyExpiresAt: dateOrNull(req.body.warrantyExpiresAt) } : {}),
        ...(req.body?.notes !== undefined ? { notes: text(req.body.notes) } : {}),
        ...(typeof req.body?.isArchived === "boolean" ? { isArchived: req.body.isArchived } : {}),
      },
    }, { new: true, runValidators: true });
    await writeServiceActivity({
      organizationId,
      action: "installed_equipment_updated",
      message: `Updated installed equipment ${item?.name ?? current.name}`,
      actorId,
      metadata: { installedEquipmentId: current._id, customerId: current.customerId },
    });
    res.json({ item });
  } catch (error: any) {
    res.status(error?.code === 11000 ? 409 : 500).json({ error: error?.code === 11000 ? "Serial number already exists" : "Failed to update installed equipment" });
  }
}

export async function deleteInstalledEquipment(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    if (await ServiceRequest.exists({ organizationId, installedEquipmentId: req.params.equipmentId })) {
      res.status(409).json({ error: "Archive this equipment because it is referenced by service requests" });
      return;
    }
    const item = await InstalledEquipment.findOneAndDelete({ _id: req.params.equipmentId, organizationId });
    if (!item) {
      res.status(404).json({ error: "Installed equipment not found" });
      return;
    }
    await writeServiceActivity({
      organizationId,
      action: "installed_equipment_deleted",
      message: `Deleted installed equipment ${item.name}`,
      actorId,
      metadata: { installedEquipmentId: item._id, customerId: item.customerId },
    });
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete installed equipment" });
  }
}

export async function linkTicket(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const [item, ticket] = await Promise.all([
      ServiceRequest.findOne({ _id: req.params.id, organizationId }),
      Ticket.findOne({ _id: req.params.ticketId, organizationId }),
    ]);
    if (!item || !ticket) {
      res.status(404).json({ error: "Service request or ticket not found" });
      return;
    }
    ticket.serviceRequestId = item._id;
    await ticket.save();
    await writeServiceActivity({
      organizationId,
      serviceRequestId: item._id,
      action: "ticket_linked",
      message: `Linked support ticket ${ticket.ticketReference}`,
      actorId,
      metadata: { ticketId: ticket._id },
    });
    res.json({ ticket });
  } catch {
    res.status(500).json({ error: "Failed to link ticket" });
  }
}

export async function unlinkTicket(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, actorId } = context(req);
    const item = await ServiceRequest.findOne({ _id: req.params.id, organizationId });
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, organizationId, serviceRequestId: req.params.id });
    if (!item || !ticket) {
      res.status(404).json({ error: "Linked ticket not found" });
      return;
    }
    ticket.serviceRequestId = null;
    await ticket.save();
    await writeServiceActivity({
      organizationId,
      serviceRequestId: item._id,
      action: "ticket_unlinked",
      message: `Unlinked support ticket ${ticket.ticketReference}`,
      actorId,
      metadata: { ticketId: ticket._id },
    });
    res.json({ ticket });
  } catch {
    res.status(500).json({ error: "Failed to unlink ticket" });
  }
}

export async function createServiceRequestFromTicket(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, organizationId: orgReq.organization._id });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (ticket.serviceRequestId) {
      res.status(409).json({ error: "Ticket is already linked to a service request", serviceRequestId: ticket.serviceRequestId });
      return;
    }
    if (!ticket.customerId && !req.body?.customerId) {
      res.status(400).json({ error: "A customer must be linked to the ticket or supplied" });
      return;
    }
    const organizationId = orgReq.organization._id;
    const actorId = orgReq.user.id;
    const customerId = text(req.body?.customerId) || String(ticket.customerId);
    const title = text(req.body?.title) || ticket.subject || ticket.initialIssue.slice(0, 300);
    const assignedEmployeeIds = ids(req.body?.assignedEmployeeIds);
    if (!(await validateServiceRelations({
      organizationId,
      customerId,
      customerSiteId: nullableId(req.body?.customerSiteId),
      installedEquipmentId: nullableId(req.body?.installedEquipmentId),
      assignedEmployeeIds,
    }))) {
      res.status(400).json({ error: "One or more customer, site, equipment, or employee references are invalid" });
      return;
    }
    const [status, numbering, duplicateWarning] = await Promise.all([
      resolveServiceStatus(organizationId, text(req.body?.statusId) || undefined),
      nextServiceReference(organizationId, "service_request"),
      duplicateCandidates({
        organizationId,
        customerId,
        title,
        installedEquipmentId: nullableId(req.body?.installedEquipmentId),
      }),
    ]);
    const item = await ServiceRequest.create({
      organizationId,
      ...numbering,
      type: "service_request",
      customerId,
      customerSiteId: nullableId(req.body?.customerSiteId),
      installedEquipmentId: nullableId(req.body?.installedEquipmentId),
      title,
      description: text(req.body?.description) || ticket.initialIssue,
      priority: SERVICE_PRIORITIES.includes(req.body?.priority) ? req.body.priority : "medium",
      statusId: status.id,
      systemCategory: status.systemCategory,
      assignedEmployeeIds,
      sourceTicketId: ticket._id,
      dueAt: dateOrNull(req.body?.dueAt),
      createdBy: actorId,
      updatedBy: actorId,
    });
    ticket.serviceRequestId = item._id;
    await ticket.save();
    await writeServiceActivity({
      organizationId,
      serviceRequestId: item._id,
      action: "created_from_ticket",
      message: `Created ${item.reference} from support ticket ${ticket.ticketReference}`,
      actorId,
      metadata: { ticketId: ticket._id },
    });
    res.status(201).json({ item, ticket, duplicateWarning });
  } catch (error) {
    console.error("Failed to create service request from ticket:", error);
    res.status(500).json({ error: "Failed to create service request from ticket" });
  }
}
