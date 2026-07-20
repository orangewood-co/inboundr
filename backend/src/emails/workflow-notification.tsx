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

interface WorkflowNotificationEmailProps {
  subject: string;
  body: string;
  workflowName: string;
  organizationName: string;
  companyName?: string;
}

export function WorkflowNotificationEmail({
  subject,
  body,
  workflowName,
  organizationName,
  companyName = "Inboundr.co",
}: WorkflowNotificationEmailProps) {
  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>

        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Preview>{subject}</Preview>
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

                <Section className="bg-bg-2 mobile:px-6 mobile:py-12 rounded-[8px] px-[40px] py-[48px] text-left">
                  <Heading as="h1" className="font-28 text-fg m-0 mb-4 font-sans">
                    {subject}
                  </Heading>

                  <Text className="font-16 text-fg-2 mt-0 mb-6 whitespace-pre-wrap font-sans">
                    {body}
                  </Text>

                  <Text className="font-13 text-fg-3 m-0 font-sans">
                    Sent by the &ldquo;{workflowName}&rdquo; workflow in {organizationName}.
                  </Text>
                </Section>

                <Section className="bg-bg">
                  <Row>
                    <Column className="px-6 py-10 text-center">
                      <Text className="font-13 text-fg-3 mx-auto mt-0 mb-0 max-w-[280px] text-center font-sans">
                        Turn inbound into revenue.
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

WorkflowNotificationEmail.PreviewProps = {
  subject: "New RFQ from Acme Corp",
  body: "An RFQ was identified from Acme Corp.\n\nCustomer: Jane Doe\nProducts: 3",
  workflowName: "RFQ Alerts",
  organizationName: "BTSA",
} satisfies WorkflowNotificationEmailProps;

export default WorkflowNotificationEmail;
