import { sendDuePaymentReminders } from "../services/payment-reminder.service";

export function startPaymentReminderCron(): void {
  Bun.cron("0 * * * *", async () => {
    try {
      await sendDuePaymentReminders();
    } catch (err) {
      console.error("Payment reminder cron failed:", err);
    }
  });

  console.log("Payment reminder cron scheduled (runs at the top of every hour)");
}
