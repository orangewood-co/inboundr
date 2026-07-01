import { Section, Text } from "react-email";
import {
  SupportEmailShell,
  SupportHero,
  TicketSummaryCard,
  type SupportEmailBaseProps,
} from "./support-email-shared";

export interface SupportTranscriptEmailProps extends SupportEmailBaseProps {}

export function SupportTranscriptEmail({
  organizationName,
  requesterName,
  ticketReference,
  initialIssue,
  messages,
  rating,
  feedbackComment,
  companyName,
}: SupportTranscriptEmailProps) {
  const greetingName = requesterName?.trim() || "there";

  return (
    <SupportEmailShell
      companyName={companyName}
      preview={`Your ${organizationName} support transcript`}
    >
      <SupportHero title="Support transcript">
        <Text className="font-16 text-fg-2 mx-auto mt-0 mb-8 max-w-[420px] text-center font-sans">
          Hi {greetingName}, here&apos;s a copy of your support conversation with{" "}
          <strong>{organizationName}</strong>.
        </Text>

        <Section className="mx-auto mb-8 max-w-[440px] text-left">
          <TicketSummaryCard
            ticketReference={ticketReference}
            initialIssue={initialIssue}
            rating={rating}
            feedbackComment={feedbackComment}
          />

          {messages.map((message, index) => (
            <Section key={index} className="bg-bg mb-3 rounded-lg px-5 py-4">
              <Text className="font-13 text-fg m-0 font-sans">
                <strong>{message.author}</strong>
              </Text>
              <Text className="font-13 text-fg-3 mt-1 mb-0 font-sans">
                {message.createdAt}
              </Text>
              {message.bodyText ? (
                <Text className="font-13 text-fg-2 mt-2 mb-0 whitespace-pre-wrap font-sans">
                  {message.bodyText}
                </Text>
              ) : null}
              {message.attachments.length > 0 ? (
                <Text className="font-13 text-fg-3 mt-2 mb-0 font-sans">
                  Attachments: {message.attachments.join(", ")}
                </Text>
              ) : null}
            </Section>
          ))}
        </Section>

        <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-center font-sans">
          You&apos;re receiving this because you requested a copy of your support
          conversation.
        </Text>
      </SupportHero>
    </SupportEmailShell>
  );
}

SupportTranscriptEmail.PreviewProps = {
  organizationName: "Acme",
  requesterName: "Tushar",
  ticketReference: "SR-000042",
  initialIssue: "Need help with an order",
  messages: [
    {
      author: "Customer",
      bodyText: "Can you help me with this?",
      attachments: [],
      createdAt: "14 Jun 2026, 2:10 pm",
    },
  ],
  rating: 5,
  feedbackComment: "Helpful support",
} satisfies SupportTranscriptEmailProps;

export default SupportTranscriptEmail;
