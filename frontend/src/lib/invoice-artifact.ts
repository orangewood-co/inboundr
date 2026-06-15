import { create } from "zustand"

export type InvoiceArtifact = {
  type: "invoice"
  invoiceId: string
  invoiceNumber: string
}

export type ProductArtifact = {
  type: "product"
  product: {
    id: number
    brand: string | null
    description: string | null
    code: string | null
    price: number | null
    hsnCode: string | null
    gstRate: number | null
    calibrationCharges: number | null
    link: string | null
    isTopSeller: boolean
  }
}

export type CustomerArtifact = {
  type: "customer"
  customer: {
    id: string
    name: string
    company: string
    email: string
    contactNumber: string
    address: string
  }
}

export type ChatArtifact = InvoiceArtifact | ProductArtifact | CustomerArtifact

type ChatArtifactState = {
  artifact: ChatArtifact | null
  open: (artifact: ChatArtifact) => void
  close: () => void
}

export const useChatArtifact = create<ChatArtifactState>((set) => ({
  artifact: null,
  open: (artifact) => set({ artifact }),
  close: () => set({ artifact: null }),
}))

export const useInvoiceArtifact = useChatArtifact
