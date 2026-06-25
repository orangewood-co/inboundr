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

export interface FeedbackReplyEmailProps {
  name: string;
  reply: string;
  originalMessage: string;
  threadUrl: string;
  companyName?: string;
}

export function FeedbackReplyEmail({
  name,
  reply,
  originalMessage,
  threadUrl,
  companyName = "Inboundr.co",
}: FeedbackReplyEmailProps) {
  const greetingName = name.trim() || "there";

  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>

        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Preview>You have a reply to your feedback</Preview>
          <Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-[640px]">
            <Section>
              <Section className="bg-bg mobile:px-2 px-6 py-4">
                <Section className="mb-3 px-6">
                  <Row>
                    <Column className="w-1/2 py-[7px] align-middle">
                      <Img
                        src="https://inboundr.co/logo-black.png"
                        alt=""
                        width={140}
                        className="block"
                      />
                    </Column>
                    <Column align="right" className="w-1/2 py-[7px] align-middle">
                      <Text className="font-13 m-0 text-right font-sans">
                        <span className="text-fg-3">{companyName}</span>
                      </Text>
                    </Column>
                  </Row>
                </Section>

                <Section className="bg-bg-2 mobile:px-6 mobile:py-12 rounded-[8px] px-[40px] py-[64px] text-left">
                  <Heading as="h1" className="font-28 text-fg m-0 font-sans">
                    We replied to your feedback
                  </Heading>
                  <Text className="font-16 text-fg-2 mt-6 mb-0 font-sans">
                    Hi {greetingName}, the Inboundr team responded to your
                    submission.
                  </Text>
                  <Section className="bg-bg mt-6 rounded-lg px-5 py-4">
                    <Text className="font-13 text-fg m-0 font-sans">
                      <strong>Our reply</strong>
                    </Text>
                    <Text className="font-13 text-fg-2 mt-3 mb-0 whitespace-pre-wrap font-sans">
                      {reply}
                    </Text>
                  </Section>
                  <Section className="bg-bg mt-3 rounded-lg px-5 py-4">
                    <Text className="font-13 text-fg-3 m-0 font-sans">
                      <strong>Your original message</strong>
                    </Text>
                    <Text className="font-13 text-fg-3 mt-3 mb-0 whitespace-pre-wrap font-sans">
                      {originalMessage}
                    </Text>
                  </Section>
                  <Text className="font-13 text-fg-2 mt-6 mb-0 font-sans">
                    Continue the conversation at{" "}
                    <a href={threadUrl} className="text-fg underline">
                      {threadUrl}
                    </a>
                    .
                  </Text>
                </Section>
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

FeedbackReplyEmail.PreviewProps = {
  companyName: "Inboundr.co",
  name: "Customer",
  originalMessage: "It would be great if the orders table could be exported to CSV.",
  reply: "Thanks for the suggestion! CSV export is now on our roadmap.",
  threadUrl: "https://app.inboundr.co/feedback",
} satisfies FeedbackReplyEmailProps;

export default FeedbackReplyEmail;
