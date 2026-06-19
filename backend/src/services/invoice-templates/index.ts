import type { ComponentType } from "react";
import {
  DEFAULT_INVOICE_TEMPLATE,
  normalizeInvoiceTemplateId,
  type InvoiceTemplateId,
} from "../../models/invoice.model";
import { ClassicTemplate } from "./ClassicTemplate";
import { MinimalTemplate } from "./MinimalTemplate";
import { StandardTemplate } from "./StandardTemplate";
import type { InvoiceTemplateProps } from "./types";

export type InvoiceTemplateMeta = {
  id: InvoiceTemplateId;
  label: string;
  description: string;
  component: ComponentType<InvoiceTemplateProps>;
};

export const INVOICE_TEMPLATES: Record<InvoiceTemplateId, InvoiceTemplateMeta> = {
  minimal: {
    id: "minimal",
    label: "Minimal",
    description: "Monospace, typewriter-style layout. Clean and distraction-free.",
    component: MinimalTemplate,
  },
  classic: {
    id: "classic",
    label: "Classic",
    description: "Bold centered header with a prominent logo and tidy summary.",
    component: ClassicTemplate,
  },
  standard: {
    id: "standard",
    label: "Standard",
    description: "Branded layout with accent color, summary cards, and totals.",
    component: StandardTemplate,
  },
};

export function getInvoiceTemplate(id: unknown): InvoiceTemplateMeta {
  const normalized = normalizeInvoiceTemplateId(id);
  return INVOICE_TEMPLATES[normalized] ?? INVOICE_TEMPLATES[DEFAULT_INVOICE_TEMPLATE];
}

export type { InvoiceTemplateProps } from "./types";
