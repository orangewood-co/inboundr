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

export interface ProjectUpdateEmailProps {
  organizationName: string;
  projectTitle: string;
  actorName: string;
  message: string;
  projectUrl: string;
  companyName?: string;
}

export function ProjectUpdateEmail({
  organizationName,
  projectTitle,
  actorName,
  message,
  projectUrl,
  companyName = "Inboundr.co",
}: ProjectUpdateEmailProps) {
  const displayActor = actorName.trim() || "A teammate";

  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html lang="en">
        <Head>
          <BarebonesFonts />
        </Head>
        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Preview>
            {projectTitle} was updated in {organizationName}
          </Preview>
          <Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-[640px]">
            <Section className="bg-bg mobile:px-2 px-6 py-4">
              <Section className="mb-3 px-6 text-left">
                <Img
                  src="https://inboundr.co/logo-black.png"
                  alt={companyName}
                  width={180}
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
                  Project update
                </Heading>
                <Text className="font-16 text-fg-2 mx-auto mt-4 mb-4 max-w-[420px] text-center font-sans">
                  <strong>{displayActor}</strong> updated{" "}
                  <strong>{projectTitle}</strong> in {organizationName}.
                </Text>
                <Section className="bg-bg mx-auto my-6 max-w-[440px] rounded-lg px-5 py-4 text-left">
                  <Text className="font-13 text-fg-2 m-0 font-sans">{message}</Text>
                </Section>
                <Button
                  href={projectUrl}
                  className="bg-fg font-16 text-fg-inverted inline-block rounded-lg px-7 py-4 text-center font-sans leading-6"
                >
                  Open project
                </Button>
                <Text className="font-13 text-fg-3 mx-auto mt-8 mb-0 max-w-[400px] text-center font-sans">
                  You are receiving this because you follow this project.
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}

ProjectUpdateEmail.PreviewProps = {
  actorName: "A teammate",
  message: "A task moved to In Review.",
  organizationName: "Acme",
  projectTitle: "Product Launch",
  projectUrl: "https://example.com/projects/1",
} satisfies ProjectUpdateEmailProps;

export default ProjectUpdateEmail;
