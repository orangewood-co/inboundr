import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Customer } from "../models/customer.model";
import type { OrganizationRequest } from "../middleware/auth.middleware";
import {
  activeCustomerFields,
  customerCustomFieldsToObject,
  getOrCreateCustomerSettings,
  isSpecialDiscountEnabled,
  normalizeCustomerFieldDefinitions,
  normalizeCustomerFieldValues,
} from "../services/customer-field.service";

export const archiveCustomer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid customer id" });
      return;
    }

    const orgReq = req as OrganizationRequest;
    const organization = orgReq.organization;

    const customer = await Customer.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      { isArchived: true },
      { new: true }
    ).lean();

    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    res.json({ message: "Customer archived", customer });
  } catch (err) {
    console.error("Error archiving customer:", err);
    res.status(500).json({ error: "Failed to archive customer" });
  }
};

const SEARCH_FIELDS = ["name", "company", "email", "contactNumber", "address", "notes"] as const;
const EDITABLE_FIELDS = [
  "name",
  "company",
  "email",
  "contactNumber",
  "address",
  "notes",
  "specialDiscountPercentage",
] as const;

function serializeCustomer(customer: any) {
  if (!customer) return customer;
  const source = typeof customer.toObject === "function" ? customer.toObject() : customer;
  return {
    ...source,
    customFields: customerCustomFieldsToObject(source.customFields),
  };
}

function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = parseInt(String(value ?? ""), 10);
  const normalized = Number.isFinite(parsed) ? Math.max(1, parsed) : fallback;
  return max ? Math.min(max, normalized) : normalized;
}

function normalizeCustomerInput(body: Record<string, unknown>): Record<string, string | number | null> {
  const input: Record<string, string | number | null> = {};

  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      if (field === "specialDiscountPercentage") {
        const value = Number(body[field] ?? 0);
        input[field] = Number.isFinite(value) ? value : 0;
      } else if (field === "notes") {
        const value = String(body[field] ?? "").trim();
        input[field] = value || null;
      } else {
        input[field] = String(body[field] ?? "").trim();
      }
    }
  }

  return input;
}

function validateCustomerInput(input: Record<string, string | number | null>): string | null {
  if ("name" in input && !input.name) return "Customer name is required";
  if ("company" in input && !input.company) return "Company is required";
  if ("email" in input && !input.email) return "Email is required";
  if (
    "specialDiscountPercentage" in input &&
    (typeof input.specialDiscountPercentage !== "number" ||
      input.specialDiscountPercentage < 0 ||
      input.specialDiscountPercentage > 100)
  ) {
    return "Special discount must be between 0 and 100";
  }
  return null;
}

export const getCustomerSettings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const organization = (req as OrganizationRequest).organization;
    const settings = await getOrCreateCustomerSettings(organization._id);
    res.json({
      fieldDefinitions: [...settings.fieldDefinitions].sort(
        (a, b) => a.order - b.order || a.label.localeCompare(b.label)
      ),
    });
  } catch (err) {
    console.error("Error fetching customer settings:", err);
    res.status(500).json({ error: "Failed to fetch customer settings" });
  }
};

export const updateCustomerSettings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const organization = (req as OrganizationRequest).organization;
    const settings = await getOrCreateCustomerSettings(organization._id);
    settings.fieldDefinitions = normalizeCustomerFieldDefinitions(
      req.body?.fieldDefinitions,
      [...settings.fieldDefinitions]
    );
    await settings.save();
    res.json({ fieldDefinitions: settings.fieldDefinitions });
  } catch (err) {
    console.error("Error updating customer settings:", err);
    const statusCode = (err as any)?.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 400 ? (err as Error).message : "Failed to update customer settings",
    });
  }
};

export const listCustomers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const organization = orgReq.organization;
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20, 50);
    const skip = (page - 1) * limit;
    const search = String(req.query.search ?? "").trim();

    const filter = {
      organizationId: organization._id,
      isArchived: { $ne: true },
      ...(search
        ? {
          $or: SEARCH_FIELDS.map((field) => ({
            [field]: { $regex: search, $options: "i" },
          })),
        }
        : {}),
    };

    const [customers, total, settings] = await Promise.all([
      Customer.find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter),
      getOrCreateCustomerSettings(organization._id),
    ]);

    res.json({
      customers: customers.map(serializeCustomer),
      fieldDefinitions: activeCustomerFields([...settings.fieldDefinitions]),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error listing customers:", err);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
};

export const createCustomer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const input = normalizeCustomerInput(req.body ?? {});
    const orgReq = req as OrganizationRequest;
    const organization = orgReq.organization;
    const settings = await getOrCreateCustomerSettings(organization._id);
    const customFields = normalizeCustomerFieldValues(
      req.body?.customFields,
      [...settings.fieldDefinitions]
    );
    if (!isSpecialDiscountEnabled([...settings.fieldDefinitions])) {
      delete input.specialDiscountPercentage;
    }
    const validationError = validateCustomerInput(input);

    if (!input.name || !input.company || !input.email) {
      res.status(400).json({ error: "Name, company, and email are required" });
      return;
    }

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const customer = await Customer.create({
      ...input,
      customFields,
      organizationId: organization._id,
    });

    res.status(201).json(serializeCustomer(customer));
  } catch (err) {
    console.error("Error creating customer:", err);
    const statusCode = (err as any)?.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 400 ? (err as Error).message : "Failed to create customer",
    });
  }
};

export const getCustomer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid customer id" });
      return;
    }

    const orgReq = req as OrganizationRequest;
    const organization = orgReq.organization;

    const customer = await Customer.findOne({
      _id: id,
      organizationId: organization._id,
    }).lean();

    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    res.json(serializeCustomer(customer));
  } catch (err) {
    console.error("Error fetching customer:", err);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
};

export const updateCustomer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = String(req.params.id ?? "");
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid customer id" });
      return;
    }

    const input = normalizeCustomerInput(req.body ?? {});
    const orgReq = req as OrganizationRequest;
    const organization = orgReq.organization;
    const settings = await getOrCreateCustomerSettings(organization._id);
    if (!isSpecialDiscountEnabled([...settings.fieldDefinitions])) {
      delete input.specialDiscountPercentage;
    }
    const customFieldUpdates =
      req.body?.customFields === undefined
        ? null
        : normalizeCustomerFieldValues(req.body.customFields, [...settings.fieldDefinitions]);
    const validationError = validateCustomerInput(input);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    let update: Record<string, unknown> = input;
    if (customFieldUpdates) {
      const existing = await Customer.findOne({
        _id: id,
        organizationId: organization._id,
      })
        .select("customFields")
        .lean();
      if (!existing) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }
      update = {
        ...input,
        customFields: {
          ...customerCustomFieldsToObject(existing.customFields),
          ...customFieldUpdates,
        },
      };
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: id, organizationId: organization._id },
      update,
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    res.json(serializeCustomer(customer));
  } catch (err) {
    console.error("Error updating customer:", err);
    const statusCode = (err as any)?.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 400 ? (err as Error).message : "Failed to update customer",
    });
  }
};

export const exportCustomers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const organization = orgReq.organization;
    const search = String(req.query.search ?? "").trim();

    const filter = {
      organizationId: organization._id,
      isArchived: { $ne: true },
      ...(search
        ? {
          $or: SEARCH_FIELDS.map((field) => ({
            [field]: { $regex: search, $options: "i" },
          })),
        }
        : {}),
    };

    const [customers, settings] = await Promise.all([
      Customer.find(filter).sort({ updatedAt: -1, createdAt: -1 }).lean(),
      getOrCreateCustomerSettings(organization._id),
    ]);
    const fieldDefinitions = activeCustomerFields([...settings.fieldDefinitions]);

    const csvHeaders = [
      "Name",
      "Company",
      "Email",
      "Contact Number",
      "Address",
      "Notes",
      ...fieldDefinitions.map((field) => field.label),
    ];
    const escapeCell = (value: string | number | boolean | null | undefined): string => {
      const str = String(value ?? "");
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replaceAll('"', '""')}"`;
      }
      return str;
    };

    const rows = customers.map((c) => {
      const customFields = customerCustomFieldsToObject(c.customFields);
      return [
        escapeCell(c.name),
        escapeCell(c.company),
        escapeCell(c.email),
        escapeCell(c.contactNumber),
        escapeCell(c.address),
        escapeCell(c.notes),
        ...fieldDefinitions.map((field) =>
          escapeCell(
            field.isSystem
              ? c.specialDiscountPercentage
              : customFields[field.id]
          )
        ),
      ].join(",");
    });

    const csv = [csvHeaders.join(","), ...rows].join("\r\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="customers-export-${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error("Error exporting customers:", err);
    res.status(500).json({ error: "Failed to export customers" });
  }
};

type ImportMode = "skip" | "update";

type CustomerImportResult = {
  summary: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    total: number;
  };
  errors: Array<{ row: number; error: string }>;
  skipped: Array<{ row: number; email: string; reason: string }>;
};

export const importCustomers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const orgReq = req as OrganizationRequest;
    const organization = orgReq.organization;
    const mode = req.body?.mode as ImportMode;
    const customers = Array.isArray(req.body?.customers) ? req.body.customers : [];
    const settings = await getOrCreateCustomerSettings(organization._id);
    const definitions = [...settings.fieldDefinitions];
    const discountEnabled = isSpecialDiscountEnabled(definitions);

    if (mode !== "skip" && mode !== "update") {
      res.status(400).json({ error: "Import mode must be skip or update" });
      return;
    }

    if (customers.length === 0) {
      res.status(400).json({ error: "No customers provided for import" });
      return;
    }

    if (customers.length > 1000) {
      res.status(400).json({ error: "Import is limited to 1000 rows at a time" });
      return;
    }

    const result: CustomerImportResult = {
      summary: { created: 0, updated: 0, skipped: 0, failed: 0, total: customers.length },
      errors: [],
      skipped: [],
    };

    for (const [index, rawCustomer] of customers.entries()) {
      const rowNumber = index + 2;

      try {
        const input = normalizeCustomerInput(rawCustomer ?? {});
        if (!discountEnabled) delete input.specialDiscountPercentage;
        const customFields = normalizeCustomerFieldValues(
          rawCustomer?.customFields,
          definitions
        );

        if (!input.name || !input.company || !input.email) {
          result.summary.failed++;
          result.errors.push({ row: rowNumber, error: "Name, company, and email are required" });
          continue;
        }

        const validationError = validateCustomerInput(input);
        if (validationError) {
          result.summary.failed++;
          result.errors.push({ row: rowNumber, error: validationError });
          continue;
        }

        const email = String(input.email);
        const existing = await Customer.findOne({
          organizationId: organization._id,
          email,
        }).lean();

        if (existing) {
          if (mode === "skip") {
            result.summary.skipped++;
            result.skipped.push({
              row: rowNumber,
              email: String(input.email),
              reason: "Duplicate email",
            });
          } else {
            await Customer.updateOne(
              { _id: existing._id },
              {
                $set: {
                  ...input,
                  customFields: {
                    ...customerCustomFieldsToObject(existing.customFields),
                    ...customFields,
                  },
                },
              }
            );
            result.summary.updated++;
          }
        } else {
          await Customer.create({
            ...input,
            customFields,
            organizationId: organization._id,
          });
          result.summary.created++;
        }
      } catch (err) {
        result.summary.failed++;
        result.errors.push({
          row: rowNumber,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error("Error importing customers:", err);
    res.status(500).json({ error: "Failed to import customers" });
  }
};
