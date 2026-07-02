import "dotenv/config";
import type { Types } from "mongoose";

import { connectDB, disconnectDB } from "../src/config/database.config";
import { DriveNode } from "../src/models/drive-node.model";
import { indexFolderSubtree } from "../src/services/drive-knowledge.service";

/**
 * One-shot migration: enqueues every active Drive file inside a
 * "Use for chat context" folder onto the general document pipeline.
 *
 * Run from the backend directory with production env vars available:
 *   bun scripts/reindex-drive-documents.ts
 */
async function main(): Promise<void> {
  if (!process.env.SQS_DOCUMENT_QUEUE_URL) {
    console.warn(
      "SQS_DOCUMENT_QUEUE_URL is not set; documents will be processed " +
        "in-process by this script instead of the Lambda. This can take a while."
    );
  }

  await connectDB();

  const folders = await DriveNode.find({
    type: "folder",
    status: "active",
    "chatContext.enabled": true,
  }).select("_id organizationId name");

  console.log(`Found ${folders.length} chat-context folder(s).`);

  for (const folder of folders) {
    console.log(`Enqueueing files under "${folder.name}" (${String(folder._id)})...`);
    await indexFolderSubtree(
      folder.organizationId,
      folder._id as Types.ObjectId
    );
  }

  console.log("Done.");
  await disconnectDB();
  process.exit(0);
}

main().catch((err) => {
  console.error("Reindex failed:", err);
  process.exit(1);
});
