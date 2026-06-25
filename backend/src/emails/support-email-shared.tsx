import type { ReactNode } from "react";
import {
  Body,
  Button,
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

export type TranscriptMessage = {
  author: string;
  bodyText: string;
  attachments: string[];
  createdAt: string;
};

export interface SupportEmailBaseProps {
  organizationName: string;
  requesterName: string;
  ticketNumber: number;
  initialIssue: string;
  messages: TranscriptMessage[];
  rating?: number | null;
  feedbackComment?: string;
  companyName?: string;
  resumeUrl?: string;
}

export function SupportEmailShell({
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

export function SupportHero({
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

export function TicketSummaryCard({
  ticketNumber,
  initialIssue,
  rating,
  feedbackComment,
}: Pick<
  SupportEmailBaseProps,
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

export function ResumeChatButton({
  href,
  children,
}: {
  href?: string;
  children: ReactNode;
}) {
  if (!href) return null;

  return (
    <Section className="mt-8 mb-6 text-center">
      <Button
        href={href}
        className="bg-fg font-16 text-fg-inverted inline-block rounded-lg px-7 py-4 text-center font-sans leading-6"
      >
        {children}
      </Button>
    </Section>
  );
}
