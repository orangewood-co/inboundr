import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth, type Session } from "../lib/auth";
import {
  getOrganizationContextForUser,
  type OrganizationContext,
} from "../services/organization.service";
import type { OrganizationRole } from "../models/organization-member.model";

export interface AuthenticatedRequest extends Request {
  user: Session["user"];
  session: Session["session"];
}

export function requireOrganizationRole(roles: OrganizationRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const membership = (req as OrganizationRequest).organizationMembership;

    if (!membership) {
      res.status(401).json({ error: "Organization context is required" });
      return;
    }

    if (!roles.includes(membership.role)) {
      res.status(403).json({ error: "Insufficient organization permissions" });
      return;
    }

    next();
  };
}

export interface OrganizationRequest extends AuthenticatedRequest {
  organization: OrganizationContext["organization"];
  organizationMembership: OrganizationContext["membership"];
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user || !session.session) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    (req as AuthenticatedRequest).user = session.user;
    (req as AuthenticatedRequest).session = session.session;
    next();
  } catch (err) {
    console.error("Session validation failed:", err);
    res.status(401).json({ error: "Unauthorized" });
  }
}

export async function requireOrganization(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const requestedOrganizationId = req.header("x-organization-id");
    const context = await getOrganizationContextForUser(
      authReq.user,
      requestedOrganizationId
    );

    (req as OrganizationRequest).organization = context.organization;
    (req as OrganizationRequest).organizationMembership = context.membership;
    next();
  } catch (err: any) {
    console.error("Organization validation failed:", err);
    res.status(err.message === "Organization access denied" ? 403 : 400).json({
      error: err.message || "Invalid organization context",
    });
  }
}
