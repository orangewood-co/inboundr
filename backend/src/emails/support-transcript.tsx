import type { ReactNode } from "react";
import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Row,
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
  companyName?: string;
}

export interface SupportResolvedEmailProps extends SupportTranscriptEmailProps {}

function SupportEmailShell({
  companyName = "Inboundr.co",
  preview,
  children,
}: {
  companyName?: string;
  preview: string;
  children: ReactNode;
}) {
  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>

        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Preview>{preview}</Preview>
          <Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-[640px]">
            <Section>
              <Section className="bg-bg mobile:px-2 px-6 py-4">
                <Section className="mb-3 px-6">
                  <Row>
                    <Column className="w-1/2 py-[7px] align-middle">
                      <Row>
                        <Column className="w-[302px] align-middle">
                          <Img
                            src="https://inboundr.co/logo-black.png"
                            alt=""
                            width={200}
                            className="block"
                          />
                        </Column>
                      </Row>
                    </Column>
                    <Column align="right" className="w-1/2 py-[7px] align-middle">
                      <Text className="font-13 m-0 text-right font-sans">
                        <span className="text-fg-3">{companyName}</span>
                      </Text>
                    </Column>
                  </Row>
                </Section>

                {children}

                <Section className="bg-bg">
                  <Row>
                    <Column className="px-6 py-10 text-center">
                      <Text className="font-13 text-fg-3 mx-auto mt-0 mb-8 max-w-[280px] text-center font-sans">
                        Turn inbound into revenue.
                      </Text>
                      <Text className="font-11 text-fg-3 mt-4 mb-5 text-center font-sans">
                        Second Floor, A-48, Sector-67, Noida, Gautam Buddha Nagar
                        <br />
                        Uttar Pradesh, 201301
                      </Text>
                    </Column>
                  </Row>
                </Section>
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

function SupportHero({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Section className="bg-bg-2 mobile:px-6 mobile:py-12 rounded-[8px] px-[40px] py-[64px] text-center">
      <Section className="mb-3">
        <Img
          src="https://inboundr.co/mark-black.png"
          alt="Logo"
          width={48}
          className="mx-auto mb-5 block"
        />
        <Heading as="h1" className="font-28 text-fg m-0 font-sans">
          {title}
        </Heading>
      </Section>
      {children}
    </Section>
  );
}

function TicketSummaryCard({
  ticketNumber,
  initialIssue,
  rating,
  feedbackComment,
}: Pick<
  SupportTranscriptEmailProps,
  "ticketNumber" | "initialIssue" | "rating" | "feedbackComment"
>) {
  return (
    <Section className="bg-bg mb-3 rounded-lg px-5 py-4">
      <Text className="font-13 text-fg m-0 font-sans">
        <strong>Ticket #{ticketNumber}</strong>
      </Text>
      {initialIssue ? (
        <Text className="font-13 text-fg-2 mt-2 mb-0 font-sans">
          Initial issue: <strong>{initialIssue}</strong>
        </Text>
      ) : null}
      {rating ? (
        <Text className="font-13 text-fg-2 mt-2 mb-0 font-sans">
          Feedback: <strong>{rating}/5</strong>
          {feedbackComment ? ` - ${feedbackComment}` : ""}
        </Text>
      ) : null}
    </Section>
  );
}

export function SupportTranscriptEmail({
  organizationName,
  requesterName,
  ticketNumber,
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
            ticketNumber={ticketNumber}
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

export function SupportResolvedEmail({
  organizationName,
  requesterName,
  ticketNumber,
  initialIssue,
  companyName,
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
          <TicketSummaryCard ticketNumber={ticketNumber} initialIssue={initialIssue} />
        </Section>

        <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-center font-sans">
          If this still needs attention, reply to this email and the team can
          follow up.
        </Text>
      </SupportHero>
    </SupportEmailShell>
  );
}

SupportTranscriptEmail.PreviewProps = {
  organizationName: "Acme",
  requesterName: "Tushar",
  ticketNumber: 42,
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

SupportResolvedEmail.PreviewProps = {
  organizationName: "Acme",
  requesterName: "Tushar",
  ticketNumber: 42,
  initialIssue: "Need help with an order",
  messages: [],
} satisfies SupportResolvedEmailProps;

