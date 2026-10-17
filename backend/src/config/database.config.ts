import mongoose from "mongoose";
import { Email } from "../models/email.model";
import { RFQ } from "../models/rfq.model";
import { WhatsAppAccount } from "../models/whatsapp-account.model";

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected");
  });

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.log("MongoDB disconnected");
  });

  await mongoose.connect(uri, {
    // Cap the pool so background bursts (Gmail sync, RFQ jobs) queue instead
    // of exhausting Atlas connection limits shared with the auth client.
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10000,
  });
  await reconcileEmailIndexes();
  await reconcileRFQIndexes();
  await reconcileWhatsAppAccountIndexes();
}

/**
 * Outbound drafts carry no messageId until Gmail assigns one, and a unique index
 * counts every one of those as null, so only the first draft can ever be stored.
 * Two such indexes predate the draft feature and neither is declared on the
 * schema any more, so Mongoose leaves both in place:
 *
 * - `messageId_1`, unique on messageId alone.
 * - `gmailAccountId_1_messageId_1` in its original non-partial form, since
 *   Mongoose will not rebuild an index whose options changed.
 *
 * Dropping them lets the partial index the schema now declares take over. This is
 * deliberately targeted rather than a `syncIndexes()` call, which would also drop
 * unrelated indexes that are merely undeclared.
 */
const STALE_EMAIL_INDEXES = ["messageId_1", "gmailAccountId_1_messageId_1"];

async function reconcileEmailIndexes(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  try {
    const collections = await db.listCollections({ name: "emails" }).toArray();
    if (collections.length === 0) return;

    const emails = db.collection("emails");
    const indexes = await emails.indexes();

    const stale = indexes.filter(
      (index) =>
        index.name !== undefined &&
        STALE_EMAIL_INDEXES.includes(index.name) &&
        index.unique === true &&
        // The replacement carries a partial filter, so leave that one alone.
        !index.partialFilterExpression
    );
    if (stale.length === 0) return;

    for (const index of stale) {
      await emails.dropIndex(index.name!);
      console.log(`Dropped stale unique index emails.${index.name}`);
    }

    // Mongoose queues its own index build as soon as the connection opens, so it
    // may already have raced these drops and aborted with IndexOptionsConflict.
    // Rebuild explicitly instead of depending on which one won, otherwise the
    // partial index is silently missing and the second draft collides on null.
    await Email.init().catch(() => undefined);
    await Email.createIndexes();
  } catch (err) {
    console.error("Failed to reconcile email indexes:", err);
  }
}

/**
 * Manual RFQs carry no emailId, and the original non-partial unique index on
 * emailId counts every missing value as the same, so only one manual RFQ could
 * ever be stored. Drop it so the partial index the schema now declares (unique
 * only where emailId is an ObjectId) takes over. Same reasoning and approach
 * as reconcileEmailIndexes above.
 */
async function reconcileRFQIndexes(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  try {
    const collections = await db.listCollections({ name: "rfqs" }).toArray();
    if (collections.length === 0) return;

    const rfqs = db.collection("rfqs");
    const indexes = await rfqs.indexes();

    const stale = indexes.filter(
      (index) =>
        index.name === "emailId_1" &&
        index.unique === true &&
        !index.partialFilterExpression
    );
    if (stale.length === 0) return;

    for (const index of stale) {
      await rfqs.dropIndex(index.name!);
      console.log(`Dropped stale unique index rfqs.${index.name}`);
    }

    await RFQ.init().catch(() => undefined);
    await RFQ.createIndexes();
  } catch (err) {
    console.error("Failed to reconcile RFQ indexes:", err);
  }
}

/**
 * Organizations used to have exactly one WhatsApp number, enforced by a unique
 * index on organizationId. A second, RFQ-only number is now allowed, so that
 * index is dropped in favour of the (organizationId, purpose) one the schema
 * declares. Accounts saved before purposes existed are the primary number;
 * they are tagged explicitly so purpose-filtered queries find them.
 */
async function reconcileWhatsAppAccountIndexes(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  try {
    const collections = await db.listCollections({ name: "whatsappaccounts" }).toArray();
    if (collections.length === 0) return;

    const accounts = db.collection("whatsappaccounts");
    const tagged = await accounts.updateMany(
      { purpose: { $exists: false } },
      { $set: { purpose: "primary" } }
    );
    if (tagged.modifiedCount > 0) {
      console.log(`Tagged ${tagged.modifiedCount} WhatsApp account(s) as primary`);
    }

    const indexes = await accounts.indexes();
    const stale = indexes.filter(
      (index) => index.name === "organizationId_1" && index.unique === true
    );
    if (stale.length === 0) return;

    for (const index of stale) {
      await accounts.dropIndex(index.name!);
      console.log(`Dropped stale unique index whatsappaccounts.${index.name}`);
    }

    await WhatsAppAccount.init().catch(() => undefined);
    await WhatsAppAccount.createIndexes();
  } catch (err) {
    console.error("Failed to reconcile WhatsApp account indexes:", err);
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
