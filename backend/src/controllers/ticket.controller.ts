import type { Request, Response } from "express";

import type { OrganizationRequest } from "../middleware/auth.middleware";
import {
  getTicketWithMessages,
  listRelatedTickets,
  listTickets,
  normalizeTicketListStatus,
  reopenTicket as reopenTicketRecord,
  resolveTicket as resolveTicketRecord,
} from "../services/ticket.service";
import { broadcastTicketUpdate } from "../services/support-ws.service";

export async function listSupportTickets(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const tickets = await listTickets({
      organizationId: orgReq.organization._id,
      status: normalizeTicketListStatus(req.query.status),
    });
    res.json({ tickets });
  } catch (err) {
    console.error("Failed to list support tickets:", err);
    res.status(500).json({ error: "Failed to list support tickets" });
  }
}

export async function getSupportTicket(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const detail = await getTicketWithMessages({
      organizationId: orgReq.organization._id,
      ticketId: String(req.params.id ?? ""),
    });
    if (!detail) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json(detail);
  } catch (err) {
    console.error("Failed to fetch support ticket:", err);
    res.status(500).json({ error: "Failed to fetch support ticket" });
  }
}

export async function getRelatedTickets(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const tickets = await listRelatedTickets({
      organizationId: orgReq.organization._id,
      ticketId: String(req.params.id ?? ""),
    });
    if (tickets === null) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json({ tickets });
  } catch (err) {
    console.error("Failed to load related tickets:", err);
    res.status(500).json({ error: "Failed to load related tickets" });
  }
}

export async function resolveSupportTicket(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const ticket = await resolveTicketRecord({
      organizationId: orgReq.organization._id,
      ticketId: String(req.params.id ?? ""),
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    broadcastTicketUpdate(orgReq.organization._id.toString(), ticket);
    res.json({ ticket });
  } catch (err) {
    console.error("Failed to resolve support ticket:", err);
    res.status(500).json({ error: "Failed to resolve support ticket" });
  }
}

export async function reopenSupportTicket(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const ticket = await reopenTicketRecord({
      organizationId: orgReq.organization._id,
      ticketId: String(req.params.id ?? ""),
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    broadcastTicketUpdate(orgReq.organization._id.toString(), ticket);
    res.json({ ticket });
  } catch (err) {
    console.error("Failed to reopen support ticket:", err);
    res.status(500).json({ error: "Failed to reopen support ticket" });
  }
}
