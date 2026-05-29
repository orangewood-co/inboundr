import type { Request, Response } from "express";
import { createElement } from "react";
import { z } from "zod";
import { ContactAutoReplyEmail } from "../emails/contact-autoreply";
import { ContactInquiryEmail } from "../emails/contact-inquiry";
import { sendEmail } from "../lib/email";

const CONTACT_RECIPIENT = "tushar.g@orangewood.co";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("A valid email is required").max(254),
  message: z.string().trim().min(1, "Message is required").max(5000),
});

export async function submitContactForm(req: Request, res: Response) {
  const parsed = contactSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid contact form submission",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { name, email, message } = parsed.data;

  try {
    await Promise.all([
      sendEmail({
        to: email,
        subject: "We received your message",
        react: createElement(ContactAutoReplyEmail, { name }),
      }),
      sendEmail({
        to: CONTACT_RECIPIENT,
        subject: "New inquiry received",
        react: createElement(ContactInquiryEmail, { name, email, message }),
        replyTo: [email],
      }),
    ]);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Failed to send contact form emails:", err);
    res.status(500).json({
      error: "Unable to send your message right now. Please try again later.",
    });
  }
}
