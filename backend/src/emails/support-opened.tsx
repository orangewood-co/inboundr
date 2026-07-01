import { Section, Text } from "react-email";
import {
  ResumeChatButton,
  SupportEmailShell,
  SupportHero,
  TicketSummaryCard,
  type SupportEmailBaseProps,
} from "./support-email-shared";

export interface SupportOpenedEmailProps extends SupportEmailBaseProps {}

export function SupportOpenedEmail({
  organizationName,
  requesterName,
  ticketReference,
  initialIssue,
  companyName,
  resumeUrl,
}: SupportOpenedEmailProps) {
  const greetingName = requesterName?.trim() || "there";

  return (
    <SupportEmailShell
      companyName={companyName}
      preview={`Your ${organizationName} support request is open`}
    >
      <SupportHero title="Support request opened">
        <Text className="font-16 text-fg-2 mx-auto mt-0 mb-8 max-w-[420px] text-center font-sans">
          Hi {greetingName}, we received your support request for{" "}
          <strong>{organizationName}</strong>. The team can now follow up in this chat.
        </Text>

        <Section className="mx-auto mb-8 max-w-[440px] text-left">
          <TicketSummaryCard ticketReference={ticketReference} initialIssue={initialIssue} />
        </Section>

        <ResumeChatButton href={resumeUrl}>Open support chat</ResumeChatButton>

        <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-center font-sans">
          Keep this email handy. The button opens your existing conversation so
          you can continue from where you left off.
        </Text>
      </SupportHero>
    </SupportEmailShell>
  );
}

SupportOpenedEmail.PreviewProps = {
  organizationName: "Acme",
  requesterName: "Tushar",
  ticketReference: "SR-000042",
  initialIssue: "Need help with an order",
  messages: [],
  resumeUrl: "https://forms.example.com/support/organization-id?session=session-token",
} satisfies SupportOpenedEmailProps;

export default SupportOpenedEmail;
