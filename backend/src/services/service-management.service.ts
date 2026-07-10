import type { Types } from "mongoose";
import { Customer } from "../models/customer.model";
import { CustomerSite } from "../models/customer-site.model";
import { DocumentSequence } from "../models/document-sequence.model";
import { Employee } from "../models/employee.model";
import { InstalledEquipment } from "../models/installed-equipment.model";
import { ServiceActivity } from "../models/service-activity.model";
import { ServiceRequest } from "../models/service-request.model";
import {
  DEFAULT_SERVICE_STATUSES,
  ServiceManagementSettings,
  type IServiceStatusDefinition,
} from "../models/service-management-settings.model";
import type { ServiceRequestType, ServiceSystemCategory } from "../models/service-request.model";

export async function getOrCreateServiceSettings(organizationId: Types.ObjectId) {
  return ServiceManagementSettings.findOneAndUpdate(
    { organizationId },
    { $setOnInsert: { organizationId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

function fiscalYearLabel(date: Date, startMonth: number): string {
  const month = date.getUTCMonth() + 1;
  const year = date.getUTCFullYear();
  const startYear = month >= startMonth ? year : year - 1;
  return `${String(startYear).slice(-2)}-${String(startYear + 1).slice(-2)}`;
}

export async function nextServiceReference(
  organizationId: Types.ObjectId,
  type: ServiceRequestType
): Promise<{ reference: string; sequenceNumber: number; fiscalYear: string }> {
  const settings = await getOrCreateServiceSettings(organizationId);
  const prefixMap = {
    service_request: settings.prefixes.serviceRequest,
    service_visit: settings.prefixes.serviceVisit,
    spare_dispatch: settings.prefixes.spareDispatch,
    root_cause_analysis: settings.prefixes.rootCauseAnalysis,
  };
  const prefix = prefixMap[type];
  const fiscalYear = fiscalYearLabel(new Date(), settings.fiscalYearStartMonth);
  const sequence = await DocumentSequence.findOneAndUpdate(
    { organizationId, prefix, fiscalYear },
    { $inc: { value: 1 }, $setOnInsert: { organizationId, prefix, fiscalYear } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return {
    reference: `${prefix}-${fiscalYear}-${String(sequence.value).padStart(settings.numberPadding, "0")}`,
    sequenceNumber: sequence.value,
    fiscalYear,
  };
}

export async function resolveServiceStatus(
  organizationId: Types.ObjectId,
  statusId?: string,
  category?: ServiceSystemCategory
): Promise<IServiceStatusDefinition> {
  const settings = await getOrCreateServiceSettings(organizationId);
  const statuses = settings.statuses.length ? settings.statuses : DEFAULT_SERVICE_STATUSES;
  const status = statusId
    ? statuses.find((item) => item.id === statusId && item.isActive)
    : category
      ? statuses.find((item) => item.systemCategory === category && item.isActive)
      : statuses.find((item) => item.isDefault && item.isActive);
  if (!status) throw new Error("Valid service status not found");
  return status;
}

export async function validateServiceRelations(input: {
  organizationId: Types.ObjectId;
  customerId: string;
  customerSiteId?: string | null;
  installedEquipmentId?: string | null;
  assignedEmployeeIds?: string[];
  coordinatorId?: string | null;
  engineerId?: string | null;
}): Promise<boolean> {
  const employeeIds = [
    ...(input.assignedEmployeeIds ?? []),
    ...(input.coordinatorId ? [input.coordinatorId] : []),
    ...(input.engineerId ? [input.engineerId] : []),
  ];
  const uniqueEmployeeIds = [...new Set(employeeIds)];
  const [customer, site, equipment, employeeCount] = await Promise.all([
    Customer.exists({ _id: input.customerId, organizationId: input.organizationId }),
    input.customerSiteId
      ? CustomerSite.exists({
          _id: input.customerSiteId,
          organizationId: input.organizationId,
          customerId: input.customerId,
        })
      : true,
    input.installedEquipmentId
      ? InstalledEquipment.exists({
          _id: input.installedEquipmentId,
          organizationId: input.organizationId,
          customerId: input.customerId,
        })
      : true,
    uniqueEmployeeIds.length
      ? Employee.countDocuments({
          _id: { $in: uniqueEmployeeIds },
          organizationId: input.organizationId,
          status: { $ne: "archived" },
        })
      : 0,
  ]);
  return Boolean(
    customer &&
      site &&
      equipment &&
      employeeCount === uniqueEmployeeIds.length
  );
}

export async function getServiceRelationSnapshots(input: {
  organizationId: Types.ObjectId;
  customerId: string;
  customerSiteId?: string | null;
  installedEquipmentId?: string | null;
}) {
  const [customer, site, equipment] = await Promise.all([
    Customer.findOne({ _id: input.customerId, organizationId: input.organizationId }).lean(),
    input.customerSiteId
      ? CustomerSite.findOne({
          _id: input.customerSiteId,
          organizationId: input.organizationId,
          customerId: input.customerId,
        }).lean()
      : null,
    input.installedEquipmentId
      ? InstalledEquipment.findOne({
          _id: input.installedEquipmentId,
          organizationId: input.organizationId,
          customerId: input.customerId,
        }).lean()
      : null,
  ]);
  if (!customer || (input.customerSiteId && !site) || (input.installedEquipmentId && !equipment)) {
    return null;
  }
  return {
    customerSnapshot: {
      name: customer.name,
      company: customer.company,
      email: customer.email,
    },
    siteSnapshot: site
      ? {
          name: site.name,
          address: site.address,
          city: site.city,
          state: site.state,
          postalCode: site.postalCode,
          country: site.country,
        }
      : null,
    equipmentSnapshot: equipment
      ? {
          name: equipment.name,
          model: equipment.modelName,
          modelName: equipment.modelName,
          serialNumber: equipment.serialNumber,
        }
      : null,
  };
}

export async function writeServiceActivity(input: {
  organizationId: Types.ObjectId;
  serviceRequestId?: Types.ObjectId | null;
  serviceRecordId?: Types.ObjectId | null;
  action: string;
  message?: string;
  actorId: string;
  metadata?: Record<string, unknown>;
}) {
  const activity = await ServiceActivity.create({
    ...input,
    serviceRequestId: input.serviceRequestId ?? null,
    serviceRecordId: input.serviceRecordId ?? null,
    message: input.message ?? "",
    metadata: input.metadata ?? {},
  });
  if (input.serviceRequestId) {
    await ServiceRequest.updateOne(
      { _id: input.serviceRequestId, organizationId: input.organizationId },
      { $max: { lastActivityAt: activity.createdAt } }
    );
  }
  return activity;
}
