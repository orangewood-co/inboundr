import "dotenv/config";
import { connectDB, disconnectDB } from "../config/database.config";
import { Ticket } from "../models/ticket.model";
import { formatTicketReference } from "../services/ticket.service";

async function main(): Promise<void> {
  await connectDB();

  try {
    const tickets = await Ticket.find({
      $or: [{ ticketReference: { $exists: false } }, { ticketReference: "" }],
    })
      .select("_id ticketNumber")
      .lean();

    let updated = 0;
    for (const ticket of tickets) {
      await Ticket.updateOne(
        { _id: ticket._id },
        { ticketReference: formatTicketReference(ticket.ticketNumber) }
      );
      updated += 1;
    }

    console.log("Ticket reference backfill complete", {
      scanned: tickets.length,
      updated,
    });
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error("Ticket reference backfill failed:", err);
  process.exit(1);
});
