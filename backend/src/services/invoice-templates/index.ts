import type { ComponentType } from "react";
import {
  DEFAULT_INVOICE_TEMPLATE,
  normalizeInvoiceTemplateId,
  type InvoiceTemplateId,
} from "../../models/invoice.model";
import "./fonts";
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
    description: "Monochrome, monospaced receipt layout with dashed rules.",
    component: MinimalTemplate,
  },
  classic: {
    id: "classic",
    label: "Classic",
    description: "Editorial serif layout with a centered masthead and double-ruled totals.",
    component: ClassicTemplate,
  },
  standard: {
    id: "standard",
    label: "Standard",
    description: "Clean sans-serif layout that leads with the amount due. Uses your accent color sparingly.",
    component: StandardTemplate,
  },
};

export function getInvoiceTemplate(id: unknown): InvoiceTemplateMeta {
  const normalized = normalizeInvoiceTemplateId(id);
  return INVOICE_TEMPLATES[normalized] ?? INVOICE_TEMPLATES[DEFAULT_INVOICE_TEMPLATE];
}

export type { InvoiceTemplateProps } from "./types";
