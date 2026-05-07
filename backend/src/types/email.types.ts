import { z } from "zod";

export const emailAttachmentSchema = z.object({
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  attachmentId: z.string(),
});

export const parsedEmailSchema = z.object({
  messageId: z.string(),
  threadId: z.string(),
  historyId: z.string(),
  rfcMessageId: z.string().nullable(),
  references: z.string().nullable(),
  inReplyTo: z.string().nullable(),
  from: z.string(),
  to: z.string(),
  cc: z.string().nullable(),
  bcc: z.string().nullable(),
  subject: z.string(),
  date: z.string(),
  bodyText: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  snippet: z.string().nullable(),
  labels: z.array(z.string()),
  attachments: z.array(emailAttachmentSchema),
});

export type ParsedEmail = z.infer<typeof parsedEmailSchema>;
export type EmailAttachment = z.infer<typeof emailAttachmentSchema>;
