import { FadeIn } from "@/components/FadeIn"

const sections = [
  {
    title: "1. Acceptance of Terms",
    content: `By accessing or using Inboundr ("the Service"), you agree to be bound by these Terms of Service. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization to these terms.

If you do not agree to these terms, do not use the Service.`,
  },
  {
    title: "2. Description of Service",
    content: `Inboundr provides an AI-powered sales automation platform that processes inbound customer inquiries to generate replies, quotes, follow-up sequences, and sales calls on your behalf.

The Service operates on your data and under your direction. You retain ownership of all customer communications and business data processed through Inboundr.`,
  },
  {
    title: "3. Account Responsibilities",
    content: `You are responsible for:
• Maintaining the security of your account credentials
• All activity that occurs under your account
• Ensuring that your use of the Service complies with applicable laws
• The accuracy of information provided to configure AI responses, pricing rules, and product catalogs

We recommend enabling multi-factor authentication on all accounts.`,
  },
  {
    title: "4. Acceptable Use",
    content: `You agree not to use the Service to:
• Send unsolicited communications (spam) to individuals who have not inquired about your products or services
• Process data you do not have the right to process
• Violate any applicable law, regulation, or third-party rights
• Attempt to reverse-engineer, decompile, or extract the underlying AI models
• Resell or sublicense the Service without written permission

We reserve the right to suspend accounts that violate these terms.`,
  },
  {
    title: "5. Data Ownership & Processing",
    content: `You own your data. Inboundr processes your customer communications, product catalogs, and business data solely to provide the Service to you.

We do not use your data to train AI models for other customers. We do not share your data with third parties except as necessary to operate the Service (see our Privacy Policy for details on sub-processors).

Upon termination, you may export your data within 30 days. After that, all data is permanently deleted.`,
  },
  {
    title: "6. Service Availability",
    content: `We target 99.9% uptime for the Service. Scheduled maintenance windows will be communicated at least 48 hours in advance.

Inboundr is provided "as is." While we work to ensure reliability, we do not guarantee uninterrupted or error-free operation. We are not liable for losses resulting from service downtime beyond the service credits described in your subscription agreement.`,
  },
  {
    title: "7. Billing & Cancellation",
    content: `Paid plans are billed monthly or annually as selected. You may cancel at any time — access continues through the end of the current billing period.

Refunds are not provided for partial billing periods. If you believe you were billed in error, contact billing@inboundr.ai within 30 days.`,
  },
  {
    title: "8. Limitation of Liability",
    content: `To the maximum extent permitted by law, Inboundr's liability for any claim arising from or related to the Service is limited to the amount you paid for the Service in the 12 months preceding the claim.

Inboundr is not liable for indirect, incidental, consequential, or punitive damages, including lost profits, lost revenue, or lost business opportunities.`,
  },
  {
    title: "9. Changes to Terms",
    content: `We may update these terms from time to time. Material changes will be communicated via email at least 30 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance.`,
  },
  {
    title: "10. Governing Law",
    content: `These terms are governed by the laws of the Republic of India. Disputes shall be resolved through binding arbitration in Bangalore, India, unless you are located in a jurisdiction that requires local dispute resolution.`,
  },
  {
    title: "11. Contact",
    content: `For questions about these terms:

Email: legal@inboundr.ai
Response time: Within 5 business days`,
  },
]

export default function Terms() {
  return (
    <>
      <section className="noise grid-lines relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_35%_at_50%_0%,rgba(47,93,80,0.2),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-24 sm:pb-28 sm:pt-32 lg:px-8">
          <FadeIn>
            <p className="mb-5 text-[13px] font-medium uppercase tracking-[0.3em] text-green-bright">Legal</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Terms of Service
            </h1>
            <p className="mt-6 font-mono text-[13px] text-text-dim">Last updated: May 1, 2026</p>
          </FadeIn>
        </div>
      </section>

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
