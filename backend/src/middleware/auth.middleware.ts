import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth, type Session } from "../lib/auth";
import {
  getOrganizationContextForUser,
  type OrganizationContext,
} from "../services/organization.service";
import type { OrganizationRole } from "../models/organization-member.model";
import { PlatformAdmin } from "../models/platform-admin.model";
import {
  hasEffectiveFeature,
  isFeatureKey,
  type FeatureKey,
} from "../services/entitlement.service";
import {
  getEmployeeAccessState,
} from "../services/employee-access.service";
import type { EmployeeAccessModule } from "../models/employee-team.model";

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

function superAdminEmailAllowlist(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function isPlatformAdmin(user: Session["user"]): Promise<boolean> {
  const email = (user.email ?? "").toLowerCase();
  if (email && superAdminEmailAllowlist().includes(email)) return true;

  const admin = await PlatformAdmin.findOne({
    $or: [{ userId: user.id }, ...(email ? [{ email }] : [])],
  }).lean();
  return Boolean(admin);
}

export async function requireSuperAdmin(
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

    if (!(await isPlatformAdmin(authReq.user))) {
      res.status(403).json({ error: "Platform admin access required" });
      return;
    }

    next();
  } catch (err) {
    console.error("Super admin validation failed:", err);
    res.status(500).json({ error: "Failed to validate platform admin access" });
  }
}

export function requireFeature(feature: FeatureKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const organization = (req as OrganizationRequest).organization;

    if (!organization) {
      res.status(401).json({ error: "Organization context is required" });
      return;
    }

    if (organization.status === "suspended") {
      res.status(403).json({ error: "Organization is suspended" });
      return;
    }

    if (!isFeatureKey(feature) || !hasEffectiveFeature(organization, feature)) {
      res.status(403).json({ error: "Feature is not enabled for this organization" });
      return;
    }

    next();
  };
}

export function requireEmployeeModule(module: EmployeeAccessModule) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orgReq = req as OrganizationRequest;
      const access = await getEmployeeAccessState({
        organizationId: orgReq.organization._id,
        organizationMemberId: orgReq.organizationMembership?._id ?? null,
        role: orgReq.organizationMembership.role,
      });

      if (!access.enabled) {
        res.status(403).json({ error: "Employee platform access is disabled" });
        return;
      }

      if (access.restricted && !access.allowedModules.includes(module)) {
        res.status(403).json({ error: "Employee module access is restricted" });
        return;
      }

      next();
    } catch (err) {
      console.error("Employee module access validation failed:", err);
      res.status(500).json({ error: "Failed to validate employee access" });
    }
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
