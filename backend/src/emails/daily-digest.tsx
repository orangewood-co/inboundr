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

interface TopProduct {
  name: string;
  quantity: number;
}

export interface DailyDigestProps {
  userName: string;
  organizationName: string;
  date: string;
  sections: {
    emailVolume?: { total: number; rfqs: number; nonRfqs: number };
    rfqBreakdown?: { total: number; processed: number; failed: number };
    productRequests?: {
      total: number;
      topProducts: TopProduct[];
    };
    matchQuality?: {
      matched: number;
      ambiguous: number;
      noMatch: number;
      rate: number;
    };
  };
  statsPageUrl: string;
  companyName?: string;
}

export function DailyDigest({
  userName,
  organizationName,
  date,
  sections,
  statsPageUrl,
  companyName = "Inboundr.co",
}: DailyDigestProps) {
  const greetingName = userName?.trim() || "there";
  const hasSections = Object.keys(sections).length > 0;

  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>

        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Preview>
            Your daily stats digest for {organizationName} - {date}
          </Preview>
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
                      Daily stats digest
                    </Heading>
                  </Section>

                  <Text className="font-16 text-fg-2 mx-auto mt-0 mb-8 max-w-[420px] text-center font-sans">
                    Hi {greetingName}, here&apos;s your daily summary for{" "}
                    <strong>{organizationName}</strong> on {date}.
                  </Text>

                  <Section className="mx-auto mb-8 max-w-[440px] text-left">
                    {!hasSections && (
                      <Text className="font-13 text-fg-3 m-0 text-center font-sans">
                        No sections are enabled for your digest. Update your
                        preferences in Settings to start receiving stats.
                      </Text>
                    )}

                    {sections.emailVolume && (
                      <Section className="bg-bg mb-3 rounded-lg px-5 py-4">
                        <Text className="font-13 text-fg m-0 font-sans">
                          <strong>Email Volume</strong>
                        </Text>
                        <Text className="font-13 text-fg-2 mt-2 mb-0 font-sans">
                          Total received:{" "}
                          <strong>{sections.emailVolume.total}</strong>
                        </Text>
                        <Text className="font-13 text-fg-2 mt-1 mb-0 font-sans">
                          RFQs: <strong>{sections.emailVolume.rfqs}</strong>{" "}
                          | Non-RFQs:{" "}
                          <strong>{sections.emailVolume.nonRfqs}</strong>
                        </Text>
                      </Section>
                    )}

                    {sections.rfqBreakdown && (
                      <Section className="bg-bg mb-3 rounded-lg px-5 py-4">
                        <Text className="font-13 text-fg m-0 font-sans">
                          <strong>RFQ Breakdown</strong>
                        </Text>
                        <Text className="font-13 text-fg-2 mt-2 mb-0 font-sans">
                          Total RFQs:{" "}
                          <strong>{sections.rfqBreakdown.total}</strong>
                        </Text>
                        <Text className="font-13 text-fg-2 mt-1 mb-0 font-sans">
                          Processed:{" "}
                          <strong>{sections.rfqBreakdown.processed}</strong> |
                          Failed: <strong>{sections.rfqBreakdown.failed}</strong>
                        </Text>
                      </Section>
                    )}

                    {sections.productRequests && (
                      <Section className="bg-bg mb-3 rounded-lg px-5 py-4">
                        <Text className="font-13 text-fg m-0 font-sans">
                          <strong>Product Requests</strong>
                        </Text>
                        <Text className="font-13 text-fg-2 mt-2 mb-0 font-sans">
                          Total line items:{" "}
                          <strong>{sections.productRequests.total}</strong>
                        </Text>
                        {sections.productRequests.topProducts.length > 0 && (
                          <>
                            <Text className="font-13 text-fg-2 mt-2 mb-1 font-sans">
                              Top products:
                            </Text>
                            {sections.productRequests.topProducts.map(
                              (product, index) => (
                                <Text
                                  key={index}
                                  className="font-13 text-fg-3 mt-0 mb-1 font-sans"
                                >
                                  - {product.name} (qty: {product.quantity})
                                </Text>
                              ),
                            )}
                          </>
                        )}
                      </Section>
                    )}

                    {sections.matchQuality && (
                      <Section className="bg-bg mb-3 rounded-lg px-5 py-4">
                        <Text className="font-13 text-fg m-0 font-sans">
                          <strong>Match Quality</strong>
                        </Text>
                        <Text className="font-13 text-fg-2 mt-2 mb-0 font-sans">
                          Match rate:{" "}
                          <strong>{sections.matchQuality.rate}%</strong>
                        </Text>
                        <Text className="font-13 text-fg-2 mt-1 mb-0 font-sans">
                          Matched:{" "}
                          <strong>{sections.matchQuality.matched}</strong> |
                          Ambiguous:{" "}
                          <strong>{sections.matchQuality.ambiguous}</strong> |
                          No match: <strong>{sections.matchQuality.noMatch}</strong>
                        </Text>
                      </Section>
                    )}
                  </Section>

                  <Section className="mb-6 text-center">
                    <Button
                      href={statsPageUrl}
                      className="bg-fg font-16 text-fg-inverted inline-block rounded-lg px-7 py-4 text-center font-sans leading-6"
                    >
                      View full stats
                    </Button>
                  </Section>

                  <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-center font-sans">
                    You&apos;re receiving this because you enabled the daily
                    stats digest. Update your preferences in Settings &gt;
                    Notifications to change what you receive.
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

DailyDigest.PreviewProps = {
  companyName: "Inboundr.co",
  date: "May 27, 2026",
  organizationName: "Acme",
  sections: {
    emailVolume: { total: 42, rfqs: 18, nonRfqs: 24 },
    matchQuality: { matched: 15, ambiguous: 2, noMatch: 1, rate: 83 },
  },
  statsPageUrl: "https://example.com/",
  userName: "there",
} satisfies DailyDigestProps;

export default DailyDigest;
