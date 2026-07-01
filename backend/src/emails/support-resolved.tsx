import { Section, Text } from "react-email";
import {
  ResumeChatButton,
  SupportEmailShell,
  SupportHero,
  TicketSummaryCard,
  type SupportEmailBaseProps,
} from "./support-email-shared";

export interface SupportResolvedEmailProps extends SupportEmailBaseProps {}

export function SupportResolvedEmail({
  organizationName,
  requesterName,
  ticketReference,
  initialIssue,
  companyName,
  resumeUrl,
}: SupportResolvedEmailProps) {
  const greetingName = requesterName?.trim() || "there";

  return (
    <SupportEmailShell
      companyName={companyName}
      preview="Your support request was marked resolved"
    >
      <SupportHero title="Support request resolved">
        <Text className="font-16 text-fg-2 mx-auto mt-0 mb-8 max-w-[420px] text-center font-sans">
          Hi {greetingName}, <strong>{organizationName}</strong> marked your
          support request as resolved.
        </Text>

        <Section className="mx-auto mb-8 max-w-[440px] text-left">
          <TicketSummaryCard ticketReference={ticketReference} initialIssue={initialIssue} />
        </Section>

        <ResumeChatButton href={resumeUrl}>Leave feedback or reopen chat</ResumeChatButton>

        <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-center font-sans">
          Please let us know how we did. If this still needs attention, use the
          same link to send a new message and reopen the conversation.
        </Text>
      </SupportHero>
    </SupportEmailShell>
  );
}

SupportResolvedEmail.PreviewProps = {
  organizationName: "Acme",
  requesterName: "Tushar",
  ticketReference: "SR-000042",
  initialIssue: "Need help with an order",
  messages: [],
  resumeUrl: "https://forms.example.com/support/organization-id?session=session-token",
} satisfies SupportResolvedEmailProps;

export default SupportResolvedEmail;
