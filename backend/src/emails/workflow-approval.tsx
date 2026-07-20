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

interface WorkflowApprovalEmailProps {
  subject: string;
  message: string;
  approveUrl: string;
  rejectUrl: string;
  workflowName: string;
  organizationName: string;
  companyName?: string;
}

export function WorkflowApprovalEmail({
  subject,
  message,
  approveUrl,
  rejectUrl,
  workflowName,
  organizationName,
  companyName = "Inboundr.co",
}: WorkflowApprovalEmailProps) {
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

                <Section className="bg-bg-2 mobile:px-6 mobile:py-12 rounded-[8px] px-[40px] py-[48px] text-center">
                  <Img
                    src="https://inboundr.co/mark-black.png"
                    alt="Logo"
                    width={48}
                    className="mx-auto mb-5 block"
                  />
                  <Heading as="h1" className="font-28 text-fg m-0 mb-4 font-sans">
                    {subject}
                  </Heading>

                  <Text className="font-16 text-fg-2 mx-auto mt-0 mb-8 max-w-[420px] whitespace-pre-wrap text-center font-sans">
                    {message}
                  </Text>

                  <Section className="mb-2 text-center">
                    <Button
                      href={approveUrl}
                      className="bg-fg font-16 text-fg-inverted mr-3 inline-block rounded-lg px-7 py-4 text-center font-sans leading-6"
                    >
                      Approve
                    </Button>
                    <Button
                      href={rejectUrl}
                      className="font-16 text-fg inline-block rounded-lg border border-solid border-[#d4d4d0] bg-transparent px-7 py-4 text-center font-sans leading-6"
                    >
                      Reject
                    </Button>
                  </Section>

                  <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-center font-sans">
                    This request was sent by the &ldquo;{workflowName}&rdquo; workflow in{" "}
                    {organizationName}. The links expire in 7 days.
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

WorkflowApprovalEmail.PreviewProps = {
  subject: "Approval needed: RFQ from Acme Corp",
  message: "An RFQ from Acme Corp is waiting for your approval before an order is placed.",
  approveUrl: "https://example.com/approve",
  rejectUrl: "https://example.com/reject",
  workflowName: "RFQ Approval Flow",
  organizationName: "BTSA",
} satisfies WorkflowApprovalEmailProps;

export default WorkflowApprovalEmail;
