import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email";
import { barebonesBoxedTailwindConfig } from "./theme";
import { BarebonesFonts } from "./theme-fonts";

type TranscriptMessage = {
  author: string;
  bodyText: string;
  attachments: string[];
  createdAt: string;
};

export interface SupportTranscriptEmailProps {
  organizationName: string;
  requesterName: string;
  ticketNumber: number;
  initialIssue: string;
  messages: TranscriptMessage[];
  rating?: number | null;
  feedbackComment?: string;
}

export function SupportTranscriptEmail({
  organizationName,
  requesterName,
  ticketNumber,
  initialIssue,
  messages,
  rating,
  feedbackComment,
}: SupportTranscriptEmailProps) {
  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>
        <Body className="bg-bg-2 m-0 font-sans">
          <Preview>Your {organizationName} support transcript</Preview>
          <Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-[640px]">
            <Section className="bg-bg mobile:px-5 px-8 py-8">
              <Heading as="h1" className="font-28 text-fg m-0 font-sans">
                Support transcript
              </Heading>
              <Text className="font-16 text-fg-2 mt-4 mb-0 font-sans">
                Hi {requesterName || "there"}, here is a copy of your support
                conversation with {organizationName}.
              </Text>
              <Text className="font-13 text-fg-3 mt-3 mb-0 font-sans">
                Ticket #{ticketNumber}
              </Text>

              {initialIssue ? (
                <Section className="bg-bg-2 mt-6 rounded-[8px] px-4 py-3">
                  <Text className="font-13 text-fg-3 m-0 font-sans">Initial issue</Text>
                  <Text className="font-16 text-fg mt-1 mb-0 font-sans">
                    {initialIssue}
                  </Text>
                </Section>
              ) : null}

              {rating ? (
                <Section className="bg-bg-2 mt-4 rounded-[8px] px-4 py-3">
                  <Text className="font-13 text-fg-3 m-0 font-sans">Feedback</Text>
                  <Text className="font-16 text-fg mt-1 mb-0 font-sans">
                    {rating}/5{feedbackComment ? ` - ${feedbackComment}` : ""}
                  </Text>
                </Section>
              ) : null}

              <Section className="mt-6">
                {messages.map((message, index) => (
                  <Section key={index} className="border-0 border-t border-solid border-[#e7e5e4] py-4">
                    <Text className="font-13 text-fg-3 m-0 font-sans">
                      {message.author} - {message.createdAt}
                    </Text>
                    {message.bodyText ? (
                      <Text className="font-16 text-fg mt-1 mb-0 whitespace-pre-wrap font-sans">
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
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

export interface SupportResolvedEmailProps extends SupportTranscriptEmailProps {}

export function SupportResolvedEmail(props: SupportResolvedEmailProps) {
  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>
        <Body className="bg-bg-2 m-0 font-sans">
          <Preview>Your support request was marked resolved</Preview>
          <Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-[640px]">
            <Section className="bg-bg mobile:px-5 px-8 py-8">
              <Heading as="h1" className="font-28 text-fg m-0 font-sans">
                Support request resolved
              </Heading>
              <Text className="font-16 text-fg-2 mt-4 mb-0 font-sans">
                Hi {props.requesterName || "there"}, {props.organizationName} marked
                your support request as resolved.
              </Text>
              <Text className="font-13 text-fg-3 mt-3 mb-0 font-sans">
                Ticket #{props.ticketNumber}
              </Text>
              {props.initialIssue ? (
                <Section className="bg-bg-2 mt-6 rounded-[8px] px-4 py-3">
                  <Text className="font-13 text-fg-3 m-0 font-sans">Initial issue</Text>
                  <Text className="font-16 text-fg mt-1 mb-0 font-sans">
                    {props.initialIssue}
                  </Text>
                </Section>
              ) : null}
              <Text className="font-13 text-fg-3 mt-6 mb-0 font-sans">
                If this still needs attention, reply to this email and the team can
                follow up.
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

