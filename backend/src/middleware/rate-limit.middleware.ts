import {
  ipKeyGenerator,
  rateLimit,
  type Options,
  type RateLimitRequestHandler,
} from "express-rate-limit";
import type { Request } from "express";
import type { AuthenticatedRequest } from "./auth.middleware";

interface LimiterConfig {
  windowMs: number;
  limit: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: Options["keyGenerator"];
  skip?: Options["skip"];
}

function createLimiter(config: LimiterConfig): RateLimitRequestHandler {
  const options: Partial<Options> = {
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
    message: { error: config.message },
  };
  if (config.keyGenerator) options.keyGenerator = config.keyGenerator;
  if (config.skip) options.skip = config.skip;
  return rateLimit(options);
}

const MINUTE = 60 * 1000;

/**
 * Generous per-IP safety net for everything under /api/v1. This is a flood
 * backstop, not a usage quota: an SPA page load fires many parallel calls and
 * whole offices share one NAT IP, so the limit must be high and the window
 * short (a tripped bucket recovers in under a minute instead of 15).
 * Webhooks are skipped: Google Pub/Sub pushes come from a small set of shared
 * IPs that would collide in one bucket, and signature verification is the
 * right control for them.
 */
export const generalApiLimiter = createLimiter({
  windowMs: MINUTE,
  limit: 300,
  message: "Too many requests. Please try again later.",
  skip: (req: Request) => {
    const path = req.originalUrl.split("?")[0] ?? "";
    return path === "/api/v1/email/webhook";
  },
});

/** Public read-only endpoints: /f, /l, OG images, public form/workspace GETs. */
export const publicReadLimiter = createLimiter({
  windowMs: MINUTE,
  limit: 60,
  message: "Too many requests. Please try again later.",
});

/** Public mutating endpoints: form submissions, presigned uploads, attendance. */
export const publicWriteLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: 20,
  message: "Too many requests. Please try again later.",
});

export const recruitmentPublicReadLimiter = createLimiter({
  windowMs: MINUTE,
  limit: 120,
  message: "Too many careers requests. Please try again later.",
});

export const recruitmentResumeUploadLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  message: "Too many resume upload requests. Please try again later.",
});

export const recruitmentApplicationSubmitLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 5,
  message: "Too many application attempts. Please try again later.",
});

/** Contact form sends two SES emails per request, so keep it very tight. */
export const contactLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 5,
  message: "Too many messages sent. Please try again later.",
});

/**
 * Password-protected link unlock: only failed attempts count, so legitimate
 * users who know the password are never throttled.
 */
export const linkUnlockLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 5,
  skipSuccessfulRequests: true,
  message: "Too many unlock attempts. Please try again later.",
});

/**
 * Streaming AI chat costs real LLM money per request. Keyed by user id
 * (the route requires auth) with an IP fallback.
 */
export const aiChatLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 30,
  message: "You have reached the chat limit. Please try again later.",
  keyGenerator: (req: Request) => {
    const userId = (req as AuthenticatedRequest).user?.id;
    return userId ? `user:${userId}` : ipKeyGenerator(req.ip ?? "");
  },
});

const authenticatedUserKey: Options["keyGenerator"] = (req: Request) => {
  const userId = (req as AuthenticatedRequest).user?.id;
  return userId ? `user:${userId}` : ipKeyGenerator(req.ip ?? "");
};

export const recruitmentRubricGenerationLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 10,
  message: "Too many rubric generation requests. Please try again later.",
  keyGenerator: authenticatedUserKey,
});

export const recruitmentRerankLimiter = createLimiter({
  windowMs: 60 * MINUTE,
  limit: 30,
  message: "Too many recruitment ranking requests. Please try again later.",
  keyGenerator: authenticatedUserKey,
});

// Public support chat limiters, matching the limits previously enforced
// in-controller (support-chat.controller.ts).

export const supportSessionStartLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: 10,
  message: "Too many chats started. Please try again later.",
});

export const supportMessageLimiter = createLimiter({
  windowMs: MINUTE,
  limit: 15,
  message: "You are sending messages too quickly. Please slow down.",
});

export const supportSessionEndLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: 20,
  message: "Too many updates. Please try again later.",
});

export const supportUploadLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  limit: 20,
  message: "Too many uploads. Please try again later.",
});
