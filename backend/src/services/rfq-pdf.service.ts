import { createElement, type ReactElement } from "react";
import type { Response } from "express";
import { renderToStream, type DocumentProps } from "@react-pdf/renderer";
import { safePdfFilename, type PdfOrganizationBranding } from "./pdf-branding.service";
import { RFQDocument } from "./rfq-pdf/RFQDocument";
import type { PdfRFQ } from "./rfq-pdf/types";

export type { PdfRFQ };

export async function streamRFQPdf(
  rfq: PdfRFQ,
  organization: PdfOrganizationBranding,
  res: Response,
  currency = "INR"
): Promise<void> {
  // RFQDocument renders a <Document>; cast so renderToStream accepts it.
  const element = createElement(RFQDocument, {
    rfq,
    branding: organization,
    currency,
  }) as unknown as ReactElement<DocumentProps>;
  const stream = await renderToStream(element);
  const subject = rfq.emailId?.subject || `rfq_${String(rfq._id)}`;
  const filename = `rfq_${safePdfFilename(subject, String(rfq._id))}`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safePdfFilename(filename)}.pdf"`);

  stream.on("error", (err) => {
    console.error("Error streaming RFQ PDF:", err);
    res.destroy(err);
  });
  stream.pipe(res);
}
