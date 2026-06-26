import "dotenv/config";
import mongoose from "mongoose";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const db = mongoose.connection.db!;
  const sessions = await db
    .collection("callsessions")
    .find({})
    .sort({ startedAt: -1 })
    .limit(10)
    .toArray();
  console.log("=== recent callsessions (" + sessions.length + ") ===");
  for (const s of sessions) {
    console.log({
      openaiCallId: s.openaiCallId,
      phoneNumber: s.phoneNumber,
      callerNumber: s.callerNumber,
      status: s.status,
      error: s.error,
      startedAt: s.startedAt,
    });
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
