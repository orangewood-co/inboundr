import { isVobizConfigured } from "../config/telephony.config";
import { reconcileCallRecordings } from "../services/vobiz.service";

export function startCallRecordingCron(): void {
  if (!isVobizConfigured()) {
    console.log("Call recording cron skipped (Vobiz not configured)");
    return;
  }

  Bun.cron("*/2 * * * *", async () => {
    try {
      await reconcileCallRecordings();
    } catch (err) {
      console.error("Call recording reconciliation cron failed:", err);
    }
  });

  console.log("Call recording cron scheduled (runs every 2 minutes)");
}
