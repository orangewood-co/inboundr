import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "react-email";

export interface RecruitmentAcknowledgementEmailProps {
  candidateName: string;
  organizationName: string;
  jobTitle: string;
  logoUrl?: string | null;
  primaryColor?: string;
}

export function RecruitmentApplicationAcknowledgement({
  candidateName,
  organizationName,
  jobTitle,
  logoUrl,
  primaryColor = "#f5b400",
}: RecruitmentAcknowledgementEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`We received your application for ${jobTitle}`}</Preview>
      <Body style={{ margin: 0, backgroundColor: "#f4f5f7", fontFamily: "Arial, sans-serif" }}>
        <Container
          style={{
            width: "100%",
            maxWidth: "600px",
            margin: "32px auto",
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 8px 28px rgba(16,24,40,0.08)",
          }}
        >
          <Section style={{ height: "6px", backgroundColor: primaryColor }} />
          <Section style={{ padding: "34px 42px 12px" }}>
            {logoUrl ? (
              <Img
                src={logoUrl}
                alt={organizationName}
                height="40"
                style={{ maxWidth: "180px", objectFit: "contain", marginBottom: "28px" }}
              />
            ) : (
              <Text style={{ margin: "0 0 28px", fontSize: "18px", fontWeight: 700 }}>
                {organizationName}
              </Text>
            )}
            <Heading
              as="h1"
              style={{ margin: "0 0 18px", color: "#101828", fontSize: "30px", lineHeight: "38px" }}
            >
              Application received
            </Heading>
            <Text style={{ margin: "0 0 16px", color: "#344054", fontSize: "16px", lineHeight: "26px" }}>
              Hi {candidateName},
            </Text>
            <Text style={{ margin: "0 0 16px", color: "#344054", fontSize: "16px", lineHeight: "26px" }}>
              Thank you for applying for <strong>{jobTitle}</strong> at {organizationName}. Your
              application is safely with our hiring team.
            </Text>
            <Section
              style={{
                margin: "26px 0",
                padding: "18px 20px",
                borderRadius: "8px",
                backgroundColor: "#f8fafc",
                borderLeft: `4px solid ${primaryColor}`,
              }}
            >
              <Text style={{ margin: 0, color: "#475467", fontSize: "14px", lineHeight: "22px" }}>
                We review every application carefully. If your experience matches what we need,
                someone from our team will contact you using the details you provided.
              </Text>
            </Section>
            <Text style={{ margin: "0 0 30px", color: "#344054", fontSize: "16px", lineHeight: "26px" }}>
              No action is needed from you right now. You can reply to this email if you need to
              correct important information.
            </Text>
            <Hr style={{ borderColor: "#eaecf0", margin: "0 0 22px" }} />
            <Text style={{ margin: "0 0 6px", color: "#667085", fontSize: "13px", lineHeight: "20px" }}>
              With thanks,
            </Text>
            <Text style={{ margin: "0 0 32px", color: "#101828", fontSize: "14px", fontWeight: 700 }}>
              The {organizationName} hiring team
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default RecruitmentApplicationAcknowledgement;
