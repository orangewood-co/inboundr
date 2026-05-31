import type { PdfOrganizationBranding } from "./pdf-branding.service";
import { getObjectBuffer } from "./storage.service";

type OrganizationForPdfBranding = {
  _id: unknown;
  name?: string | null;
  defaultContact?: {
    email?: string | null;
    phoneNumber?: string | null;
  } | null;
  address?: string | null;
  website?: string | null;
  preferences?: {
    primaryColor?: string | null;
  } | null;
  letterheads?: Array<{
    id: string;
    key: string;
  }>;
  activeLetterheadId?: string | null;
};

export async function resolveOrganizationPdfBranding(
  organization: OrganizationForPdfBranding
): Promise<PdfOrganizationBranding> {
  const branding: PdfOrganizationBranding = {
    name: organization.name,
    email: organization.defaultContact?.email,
    phoneNumber: organization.defaultContact?.phoneNumber,
    address: organization.address,
    website: organization.website,
    primaryColor: organization.preferences?.primaryColor,
  };

  const activeLetterhead = organization.letterheads?.find(
    (letterhead) => letterhead.id === organization.activeLetterheadId
  );
  if (!activeLetterhead?.key) return branding;

  try {
    branding.letterheadBuffer = await getObjectBuffer(activeLetterhead.key);
  } catch (err) {
    console.warn(`Failed to load organization letterhead ${activeLetterhead.id}:`, err);
  }

  return branding;
}
