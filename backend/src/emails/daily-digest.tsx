import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";

interface TopProduct {
  name: string;
  quantity: number;
}

export interface DailyDigestProps {
  userName: string;
  organizationName: string;
  date: string;
  sections: {
    emailVolume?: { total: number; rfqs: number; nonRfqs: number };
    rfqBreakdown?: { total: number; processed: number; failed: number };
    productRequests?: {
      total: number;
      topProducts: TopProduct[];
    };
    matchQuality?: {
      matched: number;
      ambiguous: number;
      noMatch: number;
      rate: number;
    };
  };
  statsPageUrl: string;
}

export function DailyDigest({
  userName,
  organizationName,
  date,
  sections,
  statsPageUrl,
}: DailyDigestProps) {
  const greetingName = userName?.trim() || "there";
  const hasSections = Object.keys(sections).length > 0;

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Your daily stats digest for {organizationName} — {date}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Daily Stats Digest</Heading>
          <Text style={text}>Hi {greetingName},</Text>
          <Text style={text}>
            Here&apos;s your daily summary for <strong>{organizationName}</strong> on{" "}
            {date}.
          </Text>

          {!hasSections && (
            <Text style={mutedText}>
              No sections are enabled for your digest. Update your preferences
              in Settings to start receiving stats.
            </Text>
          )}

          {sections.emailVolume && (
            <Section style={sectionCard}>
              <Text style={sectionTitle}>Email Volume</Text>
              <Text style={metricRow}>
                Total received: <strong>{sections.emailVolume.total}</strong>
              </Text>
              <Text style={metricRow}>
                RFQs: <strong>{sections.emailVolume.rfqs}</strong> &nbsp;|&nbsp;
                Non-RFQs: <strong>{sections.emailVolume.nonRfqs}</strong>
              </Text>
            </Section>
          )}

          {sections.rfqBreakdown && (
            <Section style={sectionCard}>
              <Text style={sectionTitle}>RFQ Breakdown</Text>
              <Text style={metricRow}>
                Total RFQs: <strong>{sections.rfqBreakdown.total}</strong>
              </Text>
              <Text style={metricRow}>
                Processed: <strong>{sections.rfqBreakdown.processed}</strong>{" "}
                &nbsp;|&nbsp; Failed:{" "}
                <strong>{sections.rfqBreakdown.failed}</strong>
              </Text>
            </Section>
          )}

          {sections.productRequests && (
            <Section style={sectionCard}>
              <Text style={sectionTitle}>Product Requests</Text>
              <Text style={metricRow}>
                Total line items: <strong>{sections.productRequests.total}</strong>
              </Text>
              {sections.productRequests.topProducts.length > 0 && (
                <>
                  <Text style={metricRow}>Top products:</Text>
                  {sections.productRequests.topProducts.map((product, index) => (
                    <Text key={index} style={listItem}>
                      • {product.name} (qty: {product.quantity})
                    </Text>
                  ))}
                </>
              )}
            </Section>
          )}

          {sections.matchQuality && (
            <Section style={sectionCard}>
              <Text style={sectionTitle}>Match Quality</Text>
              <Text style={metricRow}>
                Match rate: <strong>{sections.matchQuality.rate}%</strong>
              </Text>
              <Text style={metricRow}>
                Matched: <strong>{sections.matchQuality.matched}</strong>{" "}
                &nbsp;|&nbsp; Ambiguous:{" "}
                <strong>{sections.matchQuality.ambiguous}</strong> &nbsp;|&nbsp;
                No match: <strong>{sections.matchQuality.noMatch}</strong>
              </Text>
            </Section>
          )}

          <Hr style={divider} />

          <Section style={buttonWrap}>
            <Button href={statsPageUrl} style={button}>
              View full stats
            </Button>
          </Section>

          <Text style={mutedText}>
            You&apos;re receiving this because you enabled the daily stats digest.
            Update your preferences in Settings &gt; Notifications to change
            what you receive.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default DailyDigest;

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
  fontSize: "22px",
  lineHeight: "30px",
  margin: "0 0 24px",
};

const text = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const sectionCard = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "16px",
};

const sectionTitle = {
  color: "#111827",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: "20px",
  margin: "0 0 8px",
};

const metricRow = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0 0 4px",
};

const listItem = {
  color: "#4b5563",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 2px",
  paddingLeft: "8px",
};

const divider = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};

const buttonWrap = {
  margin: "0 0 24px",
};

const button = {
  backgroundColor: "#111827",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  padding: "10px 18px",
  textDecoration: "none",
};

const mutedText = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0",
};
