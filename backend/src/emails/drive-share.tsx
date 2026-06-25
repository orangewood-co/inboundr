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

interface DriveShareEmailProps {
  organizationName: string;
  senderName?: string | null;
  itemName: string;
  itemType: "file" | "folder";
  shareUrl: string;
  hasPassword?: boolean;
  expiresAt?: string | null;
  companyName?: string;
}

export function DriveShareEmail({
  organizationName,
  senderName,
  itemName,
  itemType,
  shareUrl,
  hasPassword = false,
  expiresAt,
  companyName = "Inboundr.co",
}: DriveShareEmailProps) {
  const sharedBy = senderName?.trim() || organizationName || "A teammate";

  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>

        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Preview>{sharedBy} shared {itemName} with you</Preview>
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

                <Section className="bg-bg-2 mobile:px-6 mobile:py-12 rounded-[8px] px-[40px] py-[64px] text-center">
                  <Img
                    src="https://inboundr.co/mark-black.png"
                    alt="Logo"
                    width={48}
                    className="mx-auto mb-5 block"
                  />
                  <Heading as="h1" className="font-28 text-fg m-0 font-sans">
                    {sharedBy} shared a {itemType}
                  </Heading>
                  <Text className="font-16 text-fg-2 mx-auto mt-6 mb-0 max-w-[420px] text-center font-sans">
                    Open <strong>{itemName}</strong> from {organizationName}.
                  </Text>

                  <Section className="mt-8 mb-6 text-center">
                    <Button
                      href={shareUrl}
                      className="bg-fg font-16 text-fg-inverted inline-block rounded-lg px-7 py-4 text-center font-sans leading-6"
                    >
                      {itemType === "folder" ? "Open folder" : "Open file"}
                    </Button>
                  </Section>

                  {(hasPassword || expiresAt) && (
                    <Section className="mx-auto mt-6 max-w-[420px] rounded-lg bg-bg px-5 py-4 text-left">
                      {hasPassword && (
                        <Text className="font-13 text-fg-2 m-0 font-sans">
                          This link is password protected. Ask the sender for the password.
                        </Text>
                      )}
                      {expiresAt && (
                        <Text className={`font-13 text-fg-2 m-0 font-sans${hasPassword ? " mt-2" : ""}`}>
                          This link expires on {expiresAt}.
                        </Text>
                      )}
                    </Section>
                  )}

                  <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[420px] text-center font-sans">
                    If the button does not work, copy and paste this URL into your browser:
                    <br />
                    {shareUrl}
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

DriveShareEmail.PreviewProps = {
  expiresAt: "July 11, 2026",
  hasPassword: true,
  itemName: "basic-robot-kinematics.pptx",
  itemType: "file",
  organizationName: "Acme",
  senderName: "A teammate",
  shareUrl: "https://embed.example.com/d/iIOzzlWgJl",
} satisfies DriveShareEmailProps;

export default DriveShareEmail;
