import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from "react-email";
import { barebonesBoxedTailwindConfig } from "./theme";
import { BarebonesFonts } from "./theme-fonts";

export type AssetAssignmentEvent = "assigned" | "unassigned" | "disposed";

export interface AssetAssignmentEmailProps {
  recipientName: string;
  actorName: string;
  organizationName: string;
  assetName: string;
  assetCode: string;
  event: AssetAssignmentEvent;
  /** Only meaningful for the disposed event. */
  disposalType?: "sold" | "scrapped";
  assetUrl: string;
  companyName?: string;
}

function copyFor(props: AssetAssignmentEmailProps): {
  heading: string;
  preview: string;
  body: string;
} {
  const displayActor = props.actorName.trim() || "A teammate";
  const asset = `${props.assetName} (${props.assetCode})`;

  if (props.event === "assigned") {
    return {
      heading: "Asset assigned to you",
      preview: `${asset} was assigned to you in ${props.organizationName}`,
      body: `${displayActor} assigned ${asset} to you in ${props.organizationName}.`,
    };
  }

  if (props.event === "unassigned") {
    return {
      heading: "Asset assignment removed",
      preview: `${asset} is no longer assigned to you`,
      body: `${asset} is no longer assigned to you in ${props.organizationName}.`,
    };
  }

  const disposal = props.disposalType === "sold" ? "sold" : "scrapped";
  return {
    heading: `Asset ${disposal}`,
    preview: `${asset}, which was assigned to you, has been ${disposal}`,
    body: `${asset}, which was assigned to you, has been ${disposal} in ${props.organizationName}.`,
  };
}

export function AssetAssignmentEmail(props: AssetAssignmentEmailProps) {
  const { recipientName, assetUrl, companyName = "Inboundr.co" } = props;
  const { heading, preview, body } = copyFor(props);
  const greetingName = recipientName.trim().split(/\s+/)[0] || "there";

  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>
        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Preview>{preview}</Preview>
          <Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-[640px]">
            <Section className="bg-bg mobile:px-2 px-6 py-4">
              <Section className="mb-3 px-6 text-left">
                <Img
                  src="https://inboundr.co/logo-black.png"
                  alt={companyName}
                  width={140}
                  className="block"
                />
              </Section>
              <Section className="bg-bg-2 mobile:px-6 mobile:py-12 rounded-[8px] px-[40px] py-[56px] text-center">
                <Img
                  src="https://inboundr.co/mark-black.png"
                  alt=""
                  width={44}
                  className="mx-auto mb-5 block"
                />
                <Heading as="h1" className="font-28 text-fg m-0 font-sans">
                  {heading}
                </Heading>
                <Text className="font-16 text-fg-2 mx-auto mt-4 mb-4 max-w-[420px] text-center font-sans">
                  Hi {greetingName}, {body}
                </Text>
                <Button
                  href={assetUrl}
                  className="bg-fg font-16 text-fg-inverted inline-block rounded-lg px-7 py-4 text-center font-sans leading-6"
                >
                  View asset
                </Button>
                <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-center font-sans">
                  You are receiving this because you are listed as an employee
                  of {props.organizationName}.
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

AssetAssignmentEmail.PreviewProps = {
  recipientName: "Priya Sharma",
  actorName: "Tushar",
  organizationName: "Acme",
  assetName: "MacBook Pro 14",
  assetCode: "AST-0007",
  event: "assigned",
  assetUrl: "https://example.com/assets/1",
} satisfies AssetAssignmentEmailProps;

export default AssetAssignmentEmail;
