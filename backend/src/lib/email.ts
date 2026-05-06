import {
  SESClient,
  SendEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-ses";
import type { ReactElement } from "react";
import { render } from "react-email";

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  react: ReactElement;
  from?: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string[];
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

export async function sendEmail({
  to,
  subject,
  react,
  from,
  cc,
  bcc,
  replyTo,
}: SendEmailOptions): Promise<string | undefined> {
  const html = await render(react);
  const text = await render(react, { plainText: true });

  const input: SendEmailCommandInput = {
    Source: getSourceEmail(from),
    Destination: {
      ToAddresses: toAddressList(to),
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
