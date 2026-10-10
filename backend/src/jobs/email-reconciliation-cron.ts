import { GmailAccount } from "../models/gmail-account.model";
import {
  backfillInboxMessages,
  canProcessInbox,
  isHistoryUpdateInFlight,
} from "../services/email.service";

/**
 * Safety net for the push pipeline: the Gmail watch only sees messageAdded
 * events on INBOX, so anything it missed (a dropped notification, a message
 * moved to the inbox from Spam or a filter, a failure window) would otherwise
 * stay missing forever. This sweep compares recent INBOX messages against the
 * local store and ingests the gaps.
 */
const RECONCILE_WINDOW = "2d";

export function startEmailReconciliationCron(): void {
  Bun.cron("30 */4 * * *", async () => {
    try {
      const accounts = await GmailAccount.find({ status: "connected" });

      for (const account of accounts) {
        try {
          // A push-triggered history run is already syncing this mailbox;
          // sweeping it now would double the work for no extra coverage.
          if (isHistoryUpdateInFlight(account._id)) continue;
          if (!(await canProcessInbox(account))) continue;

          const result = await backfillInboxMessages(account, RECONCILE_WINDOW);
          if (result.ingested > 0 || result.failed > 0) {
            console.log(
              `Email reconciliation for ${account.emailAddress}: scanned ${result.scanned}, ingested ${result.ingested}, failed ${result.failed}`
            );
          }
        } catch (err) {
          console.error(
            `Email reconciliation failed for ${account.emailAddress}:`,
            err
          );
        }
      }
    } catch (err) {
      console.error("Email reconciliation cron failed:", err);
    }
  });

  console.log("Email reconciliation cron scheduled (every 4 hours)");
}
