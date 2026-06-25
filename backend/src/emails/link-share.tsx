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

interface LinkShareEmailProps {
  organizationName: string;
  senderName?: string | null;
  linkTitle?: string | null;
  destinationHost?: string | null;
  shortUrl: string;
  hasPassword?: boolean;
  requiresPreciseLocation?: boolean;
  companyName?: string;
}

export function LinkShareEmail({
  organizationName,
  senderName,
  linkTitle,
  destinationHost,
  shortUrl,
  hasPassword = false,
  requiresPreciseLocation = false,
  companyName = "Inboundr.co",
}: LinkShareEmailProps) {
  const sharedBy = senderName?.trim() || organizationName || "A teammate";
  const title = linkTitle?.trim() || destinationHost || "a link";

  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>

        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Preview>{sharedBy} shared {title} with you</Preview>
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
                    {sharedBy} shared a link
                  </Heading>
                  <Text className="font-16 text-fg-2 mx-auto mt-6 mb-0 max-w-[420px] text-center font-sans">
                    Open <strong>{title}</strong> from {organizationName}.
                  </Text>

                  <Section className="mt-8 mb-6 text-center">
                    <Button
                      href={shortUrl}
                      className="bg-fg font-16 text-fg-inverted inline-block rounded-lg px-7 py-4 text-center font-sans leading-6"
                    >
                      Open link
                    </Button>
                  </Section>

                  {(hasPassword || requiresPreciseLocation) && (
                    <Section className="mx-auto mt-6 max-w-[420px] rounded-lg bg-bg px-5 py-4 text-left">
                      {hasPassword && (
                        <Text className="font-13 text-fg-2 m-0 font-sans">
                          This link may require a password before it opens.
                        </Text>
                      )}
                      {requiresPreciseLocation && (
                        <Text className="font-13 text-fg-2 m-0 mt-2 font-sans">
                          This link may ask for location permission before redirecting.
                        </Text>
                      )}
                    </Section>
                  )}

                  <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[420px] text-center font-sans">
                    If the button does not work, copy and paste this URL into your browser:
                    <br />
                    {shortUrl}
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

LinkShareEmail.PreviewProps = {
  destinationHost: "example.com",
  hasPassword: true,
  linkTitle: "Spring launch catalog",
  organizationName: "Acme",
  requiresPreciseLocation: true,
  senderName: "A teammate",
  shortUrl: "https://api.example.com/l/spring?source=email",
} satisfies LinkShareEmailProps;

export default LinkShareEmail;
