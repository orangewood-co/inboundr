import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Customer } from "../models/customer.model";
import type { OrganizationRequest } from "../middleware/auth.middleware";

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
      ...(search
        ? {
          $or: SEARCH_FIELDS.map((field) => ({
            [field]: { $regex: search, $options: "i" },
          })),
        }
        : {}),
    };

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter),
    ]);

    res.json({
      customers,
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

export const updateCustomer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: "Invalid customer id" });
      return;
    }

    const input = normalizeCustomerInput(req.body ?? {});
    const orgReq = req as OrganizationRequest;
    const organization = orgReq.organization;
    const validationError = validateCustomerInput(input);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, organizationId: organization._id },
      input,
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    res.json(customer);
  } catch (err) {
    console.error("Error updating customer:", err);
    res.status(500).json({ error: "Failed to update customer" });
  }
};
