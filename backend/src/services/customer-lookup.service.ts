import mongoose from "mongoose";

import { Customer } from "../models/customer.model";

function digitsOf(value: string): string {
  return String(value ?? "").replace(/[^0-9]/g, "");
}

/**
 * Matches a customer by phone. `Customer.contactNumber` is free text, so the
 * comparison is on the national significant number (trailing 10 digits).
 * Returns a customer only when exactly one matches, so a shared office number
 * never silently picks the wrong account.
 */
export async function findCustomerByPhone(
  organizationId: mongoose.Types.ObjectId | string,
  phoneNumber: string
) {
  const nsn = digitsOf(phoneNumber).slice(-10);
  if (nsn.length < 7) return null;
  const candidates = await Customer.find({
    organizationId,
    isArchived: { $ne: true },
    contactNumber: { $regex: `${nsn.split("").join("[^0-9]*")}[^0-9]*$` },
  })
    .select("_id name company email contactNumber address")
    .limit(5)
    .lean();
  const exact = candidates.filter(
    (customer) => digitsOf(customer.contactNumber ?? "").slice(-10) === nsn
  );
  return exact.length === 1 && exact[0] ? exact[0] : null;
}

export async function findCustomerIdByPhone(
  organizationId: mongoose.Types.ObjectId | string,
  phoneNumber: string
): Promise<mongoose.Types.ObjectId | null> {
  const customer = await findCustomerByPhone(organizationId, phoneNumber);
  return customer?._id ?? null;
}
