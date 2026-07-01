import {
  SESClient,
  SendEmailCommand,
  SendRawEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import crypto from "node:crypto";
import type { ReactElement } from "react";
import { render } from "react-email";

export interface SendEmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
}

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: ReactElement;
  from?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
  attachments?: SendEmailAttachment[];
}

let sesClient: SESClient | null = null;

function getSesClient(): SESClient {
  const region = process.env.AWS_SES_REGION;

  if (!region) {
    throw new Error("AWS_SES_REGION environment variable is not set");
  }

  sesClient ??= new SESClient({ region });
  return sesClient;
}

function getSourceEmail(from?: string): string {
  const source = from ?? process.env.AWS_SES_FROM_EMAIL;

  if (!source) {
    throw new Error("AWS_SES_FROM_EMAIL environment variable is not set");
  }

  return source;
}

function toAddressList(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function encodeMimeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function foldBase64(value: string): string {
  return value.replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

function sanitizeBoundaryPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "");
}

function buildRawEmail(input: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  cc?: string[];
  replyTo?: string[];
  attachments: SendEmailAttachment[];
}): Buffer {
  const mixedBoundary = `mixed-${sanitizeBoundaryPart(crypto.randomUUID())}`;
  const alternativeBoundary = `alt-${sanitizeBoundaryPart(crypto.randomUUID())}`;
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to.join(", ")}`,
    input.cc?.length ? `Cc: ${input.cc.join(", ")}` : "",
    input.replyTo?.length ? `Reply-To: ${input.replyTo.join(", ")}` : "",
    `Subject: ${encodeMimeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
  ].filter(Boolean);

  const parts = [
    headers.join("\r\n"),
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    "",
    `--${alternativeBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    "",
    `--${alternativeBoundary}--`,
    "",
    ...input.attachments.flatMap((attachment) => {
      const filename = attachment.filename.replace(/["\\;]/g, "_") || "attachment";
      return [
        `--${mixedBoundary}`,
        `Content-Type: ${attachment.contentType}; name="${filename}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${filename}"`,
        "",
        foldBase64(attachment.content.toString("base64")),
        "",
      ];
    }),
    `--${mixedBoundary}--`,
    "",
  ];

  return Buffer.from(parts.join("\r\n"));
}

export async function sendEmail({
  to,
  subject,
  react,
  from,
  cc,
  bcc,
  replyTo,
  attachments = [],
}: SendEmailOptions): Promise<string | undefined> {
  const html = await render(react);
  const text = await render(react, { plainText: true });
  const source = getSourceEmail(from);
  const toAddresses = toAddressList(to);

  if (attachments.length > 0) {
    const raw = buildRawEmail({
      from: source,
      to: toAddresses,
      subject,
      html,
      text,
      cc,
      replyTo,
      attachments,
    });

    const response = await getSesClient().send(
      new SendRawEmailCommand({
        Source: source,
        Destinations: [...toAddresses, ...(cc ?? []), ...(bcc ?? [])],
        RawMessage: { Data: raw },
      })
    );
    return response.MessageId;
  }

  const input: SendEmailCommandInput = {
    Source: source,
    Destination: {
      ToAddresses: toAddresses,
      CcAddresses: cc,
      BccAddresses: bcc,
    },
    Message: {
      Subject: {
        Charset: "UTF-8",
        Data: subject,
      },
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: html,
        },
        Text: {
          Charset: "UTF-8",
          Data: text,
        },
      },
    },
    ReplyToAddresses: replyTo,
  };

  const response = await getSesClient().send(new SendEmailCommand(input));
  return response.MessageId;
}
