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

export interface FeedbackSubmittedEmailProps {
  name: string;
  email: string;
  typeLabel: string;
  moduleLabel: string;
  message: string;
  organizationName?: string | null;
  companyName?: string;
}

export function FeedbackSubmittedEmail({
  name,
  email,
  typeLabel,
  moduleLabel,
  message,
  organizationName = null,
  companyName = "Inboundr.co",
}: FeedbackSubmittedEmailProps) {
  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>

        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Preview>
            New {typeLabel} from {name}
          </Preview>
          <Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-[640px]">
            <Section>
              <Section className="bg-bg mobile:px-2 px-6 py-4">
                <Section className="mb-3 px-6">
                  <Row>
                    <Column className="w-1/2 py-[7px] align-middle">
                      <Img
                        src="https://inboundr.co/logo-black.png"
                        alt=""
                        width={200}
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
                    New {typeLabel}
                  </Heading>
                  <Section className="bg-bg mt-8 rounded-lg px-5 py-4">
                    <Text className="font-13 text-fg-2 mt-0 mb-2 font-sans">
                      <strong>From:</strong> {name}
                    </Text>
                    <Text className="font-13 text-fg-2 mt-0 mb-2 font-sans">
                      <strong>Email:</strong> {email}
                    </Text>
                    {organizationName ? (
                      <Text className="font-13 text-fg-2 mt-0 mb-2 font-sans">
                        <strong>Organization:</strong> {organizationName}
                      </Text>
                    ) : null}
                    <Text className="font-13 text-fg-2 mt-0 mb-2 font-sans">
                      <strong>Type:</strong> {typeLabel}
                    </Text>
                    <Text className="font-13 text-fg-2 mt-0 mb-0 font-sans">
                      <strong>Module:</strong> {moduleLabel}
                    </Text>
                  </Section>
                  <Section className="bg-bg mt-3 rounded-lg px-5 py-4">
                    <Text className="font-13 text-fg m-0 font-sans">
                      <strong>Message</strong>
                    </Text>
                    <Text className="font-13 text-fg-2 mt-3 mb-0 whitespace-pre-wrap font-sans">
                      {message}
                    </Text>
                  </Section>
                </Section>
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

FeedbackSubmittedEmail.PreviewProps = {
  companyName: "Inboundr.co",
  email: "person@example.com",
  message: "It would be great if the orders table could be exported to CSV.",
  moduleLabel: "Orders",
  name: "Customer",
  organizationName: "Acme Inc.",
  typeLabel: "Feature Request",
} satisfies FeedbackSubmittedEmailProps;

export default FeedbackSubmittedEmail;
