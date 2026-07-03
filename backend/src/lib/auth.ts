import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { organization } from "better-auth/plugins";
import { MongoClient } from "mongodb";
import { createElement } from "react";
import { ResetPasswordEmail } from "../emails/reset-password";
import { VerifyEmail } from "../emails/verify-email";
import { frontendOrigin } from "../config/origins.config";
import { sendEmail } from "./email";

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI environment variable is not set");
}

const mongoClient = new MongoClient(mongoUri);
const databaseName = new URL(mongoUri).pathname.replace("/", "") || undefined;
const db = mongoClient.db(databaseName);

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client: mongoClient,
  }),
  user: {
    additionalFields: {
      lastSignInAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await db.collection("user").updateOne(
            { id: session.userId },
            { $set: { lastSignInAt: session.createdAt ?? new Date() } }
          );
        },
      },
    },
  },
  trustedOrigins: [frontendOrigin],
  // Better Auth's built-in limiter (in-memory) protects all /api/auth/*
  // routes. Enabled explicitly so it also runs outside production.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/forget-password": { window: 300, max: 3 },
      "/request-password-reset": { window: 300, max: 3 },
    },
  },
  advanced: {
    // Behind Nginx, the client IP arrives via X-Forwarded-For.
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for"],
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your BTSA password",
        react: createElement(ResetPasswordEmail, {
          name: user.name,
          resetUrl: url,
        }),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your BTSA email address",
        react: createElement(VerifyEmail, {
          name: user.name,
          verificationUrl: url,
        }),
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  plugins: [
    organization({
      organizationLimit: Number(process.env.ORGANIZATION_LIMIT ?? 5),
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
