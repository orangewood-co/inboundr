import type { Request, Response } from "express";
import mongoose from "mongoose";
import { Customer } from "../models/customer.model";

const SEARCH_FIELDS = ["name", "company", "email", "contactNumber", "address"] as const;
const EDITABLE_FIELDS = ["name", "company", "email", "contactNumber", "address"] as const;

function parsePositiveInt(value: unknown, fallback: number, max?: number): number {
  const parsed = parseInt(String(value ?? ""), 10);
  const normalized = Number.isFinite(parsed) ? Math.max(1, parsed) : fallback;
  return max ? Math.min(max, normalized) : normalized;
}

function normalizeCustomerInput(body: Record<string, unknown>): Record<string, string> {
  const input: Record<string, string> = {};

  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      input[field] = String(body[field] ?? "").trim();
    }
  }

  return input;
}

function validateCustomerInput(input: Record<string, string>): string | null {
  if ("name" in input && !input.name) return "Customer name is required";
  if ("company" in input && !input.company) return "Company is required";
  if ("email" in input && !input.email) return "Email is required";
  return null;
}

export const listCustomers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20, 50);
    const skip = (page - 1) * limit;
    const search = String(req.query.search ?? "").trim();

    const filter = search
      ? {
          $or: SEARCH_FIELDS.map((field) => ({
            [field]: { $regex: search, $options: "i" },
          })),
        }
      : {};

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
    const validationError = validateCustomerInput(input);

    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const customer = await Customer.findByIdAndUpdate(req.params.id, input, {
      new: true,
      runValidators: true,
    }).lean();

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
