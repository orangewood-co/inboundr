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

interface OrganizationInvitationEmailProps {
  organizationName: string;
  inviterName?: string | null;
  inviteUrl: string;
  companyName?: string;
}

export function OrganizationInvitationEmail({
  organizationName,
  inviterName,
  inviteUrl,
  companyName = "Inboundr.co",
}: OrganizationInvitationEmailProps) {
  const invitedBy = inviterName?.trim() || "A teammate";

  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>

        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Preview>You have been invited to join {organizationName}</Preview>
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

                <Section className="bg-bg-2 mobile:px-6 mobile:py-12 rounded-[8px] px-[40px] py-[64px] text-center">
                  <Section className="mb-3">
                    <Img
                      src="https://inboundr.co/mark-black.png"
                      alt="Logo"
                      width={48}
                      className="mx-auto mb-5 block"
                    />
                    <Heading as="h1" className="font-28 text-fg m-0 font-sans">
                      Join {organizationName}
                    </Heading>
                  </Section>

                  <Text className="font-16 text-fg-2 mx-auto mt-0 mb-8 max-w-[380px] text-center font-sans">
                    {invitedBy} invited you to collaborate in the{" "}
                    <strong>{organizationName}</strong> workspace on Inboundr.
                  </Text>

                  <Section className="mb-6 text-center">
                    <Button
                      href={inviteUrl}
                      className="bg-fg font-16 text-fg-inverted inline-block rounded-lg px-7 py-4 text-center font-sans leading-6"
                    >
                      Accept invitation
                    </Button>
                  </Section>

                  <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-center font-sans">
                    If you weren&apos;t expecting this invitation, you can safely
                    ignore this email.
                  </Text>
                </Section>

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

OrganizationInvitationEmail.PreviewProps = {
  companyName: "Inboundr.co",
  inviteUrl: "https://example.com/",
  inviterName: "A teammate",
  organizationName: "Acme",
} satisfies OrganizationInvitationEmailProps;

export default OrganizationInvitationEmail;
