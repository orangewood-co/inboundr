import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";

interface ResetPasswordEmailProps {
  name?: string | null;
  resetUrl: string;
}

export function ResetPasswordEmail({ name, resetUrl }: ResetPasswordEmailProps) {
  const greetingName = name?.trim() || "there";

  return (
    <Html lang="en">
      <Head />
      <Preview>Reset your BTSA password</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Reset your password</Heading>
          <Text style={text}>Hi {greetingName},</Text>
          <Text style={text}>
            We received a request to reset your BTSA password. Use the button
            below to choose a new password.
          </Text>
          <Section style={buttonWrap}>
            <Button href={resetUrl} style={button}>
              Reset password
            </Button>
          </Section>
          <Text style={mutedText}>
            If you did not request this, you can safely ignore this email.
          </Text>
          <Text style={mutedText}>
            If the button does not work, paste this link into your browser:
          </Text>
          <Text style={linkText}>{resetUrl}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ResetPasswordEmail;

const body = {
  backgroundColor: "#f6f7f9",
  color: "#111827",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  margin: 0,
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  margin: "40px auto",
  padding: "32px",
  width: "100%",
  maxWidth: "560px",
};

const heading = {
  color: "#111827",
  fontSize: "24px",
  lineHeight: "32px",
  margin: "0 0 24px",
};

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const buttonWrap = {
  margin: "28px 0",
};

const button = {
  backgroundColor: "#111827",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 20px",
  textDecoration: "none",
};

const mutedText = {
  color: "#6b7280",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "24px 0 8px",
};

const linkText = {
  color: "#4b5563",
  fontSize: "13px",
  lineHeight: "20px",
  margin: 0,
  wordBreak: "break-all" as const,
};
