import type { Request, Response } from "express";

import type { OrganizationRequest } from "../middleware/auth.middleware";
import {
  createAndLinkTicketCustomer,
  getTicketWithMessages,
  linkTicketCustomer,
  listCustomerCandidates,
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

export async function getCustomerCandidates(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const result = await listCustomerCandidates({
      organizationId: orgReq.organization._id,
      ticketId: String(req.params.id ?? ""),
      search: String(req.query.search ?? ""),
    });
    if (!result) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    console.error("Failed to load customer candidates:", err);
    res.status(500).json({ error: "Failed to load customer matches" });
  }
}

export async function updateTicketCustomer(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const customerId = req.body?.customerId == null ? null : String(req.body.customerId);
    const ticket = await linkTicketCustomer({
      organizationId: orgReq.organization._id,
      ticketId: String(req.params.id ?? ""),
      customerId,
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket or customer not found" });
      return;
    }
    broadcastTicketUpdate(orgReq.organization._id.toString(), ticket);
    res.json({ ticket });
  } catch (err) {
    console.error("Failed to update ticket customer:", err);
    res.status(500).json({ error: "Failed to update customer match" });
  }
}

export async function createTicketCustomer(req: Request, res: Response): Promise<void> {
  try {
    const orgReq = req as OrganizationRequest;
    const ticket = await createAndLinkTicketCustomer({
      organizationId: orgReq.organization._id,
      ticketId: String(req.params.id ?? ""),
      company: String(req.body?.company ?? ""),
      contactNumber: String(req.body?.contactNumber ?? ""),
      address: String(req.body?.address ?? ""),
      notes: String(req.body?.notes ?? ""),
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    broadcastTicketUpdate(orgReq.organization._id.toString(), ticket);
    res.status(201).json({ ticket });
  } catch (err) {
    console.error("Failed to create ticket customer:", err);
    res.status(500).json({ error: "Failed to create customer" });
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
