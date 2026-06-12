import { create } from "zustand"

export type InvoiceArtifact = {
  invoiceId: string
  invoiceNumber: string
}

type InvoiceArtifactState = {
  artifact: InvoiceArtifact | null
  open: (artifact: InvoiceArtifact) => void
  close: () => void
}

export const useInvoiceArtifact = create<InvoiceArtifactState>((set) => ({
  artifact: null,
  open: (artifact) => set({ artifact }),
  close: () => set({ artifact: null }),
}))
