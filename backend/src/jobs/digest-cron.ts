import { sendHourlyDigestBatch } from "../services/digest.service";

export function startDigestCron(): void {
  Bun.cron("0 * * * *", async () => {
    try {
      await sendHourlyDigestBatch();
    } catch (err) {
      console.error("Digest cron failed:", err);
    }
  });

  console.log("Digest cron scheduled (runs at the top of every hour)");
}
