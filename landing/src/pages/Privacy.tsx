import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"

const sections = [
  {
    title: "1. Information We Collect",
    content: `We collect information you provide directly — your name, email address, company name, and any messages you send through our contact forms or customer support channels.

When you use Inboundr, we process inbound communications (emails, messages, form submissions) on your behalf to provide our AI-powered response, quoting, and follow-up services. This data belongs to you and is processed solely to deliver the service.

We also collect standard usage data: IP addresses, browser type, device information, and interaction patterns. This helps us improve the product and diagnose issues.`,
  },
  {
    title: "2. How We Use Your Information",
    content: `Your data is used to:
• Provide and improve the Inboundr service
• Process inbound leads and generate AI-driven responses on your behalf
• Send you product updates, security notices, and support communications
• Analyze usage patterns to improve performance and reliability

We do not sell your data. We do not use your customer communications to train AI models for other users. Your data is your data.`,
  },
  {
    title: "3. Data Storage & Security",
    content: `All data is encrypted in transit (TLS 1.3) and at rest (AES-256). We host our infrastructure on leading cloud providers with SOC 2 Type II compliance.

Customer communications processed by Inboundr are stored for the duration of your subscription plus 30 days, after which they are permanently deleted unless you request earlier deletion.

Access to customer data is restricted to essential personnel with role-based access controls, audit logging, and mandatory multi-factor authentication.`,
  },
  {
    title: "4. Third-Party Services",
    content: `We use a limited set of third-party services to operate Inboundr:
• Cloud infrastructure providers for hosting and compute
• AI model providers for natural language processing (your data is not used to train their models)
• Payment processors for billing
• Analytics tools for product improvement (anonymized data only)

Each provider is vetted for security and compliance. We maintain data processing agreements with all sub-processors.`,
  },
  {
    title: "5. Your Rights",
    content: `You have the right to:
• Access the personal data we hold about you
• Request correction of inaccurate data
• Request deletion of your data
• Export your data in a standard format
• Object to processing for specific purposes
• Withdraw consent at any time

To exercise any of these rights, contact us at privacy@inboundr.ai. We respond within 30 days.`,
  },
  {
    title: "6. Cookies",
    content: `We use essential cookies for authentication and session management. We use analytics cookies to understand how people use our website. You can disable non-essential cookies in your browser settings without affecting the core service.`,
  },
  {
    title: "7. Changes to This Policy",
    content: `We may update this policy from time to time. Material changes will be communicated via email to active customers at least 30 days before they take effect. The "Last updated" date at the top of this page always reflects the most recent revision.`,
  },
  {
    title: "8. Contact",
    content: `For questions about this privacy policy or our data practices:

Email: privacy@inboundr.ai
Response time: Within 5 business days`,
  },
]

export default function Privacy() {
  return (
    <>
      <PageHeader label="Legal" title="Privacy Policy">
        <p className="mt-6 font-mono text-[13px] text-text-dim">Last updated: May 1, 2026</p>
      </PageHeader>

      <section className="px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {sections.map((s, i) => (
            <FadeIn key={s.title} delay={i * 0.04}>
              <div className="mb-12">
                <h2 className="mb-4 text-xl font-bold">{s.title}</h2>
                <div className="whitespace-pre-line text-sm leading-relaxed text-text-muted">{s.content}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>
    </>
  )
}
