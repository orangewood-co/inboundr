import { useState } from "react"
import {
  ClipboardListIcon,
  FileTextIcon,
  LoaderIcon,
  MessageSquareIcon,
  StarIcon,
  TargetIcon,
  UsersIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function fieldId() {
  return `field_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

type TemplateField = {
  id: string
  label: string
  type: string
  required: boolean
  description?: string | null
  placeholder?: string | null
  options?: string[]
}

type FormTemplate = {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  formTitle: string
  formDescription: string
  fields: () => TemplateField[]
}

const TEMPLATES: FormTemplate[] = [
  {
    id: "blank",
    title: "Blank form",
    description: "Start from scratch with an empty form",
    icon: <ClipboardListIcon className="size-5" />,
    formTitle: "Untitled form",
    formDescription: "",
    fields: () => [
      { id: fieldId(), label: "Your email", type: "email", required: true, placeholder: "name@company.com" },
    ],
  },
  {
    id: "contact",
    title: "Contact Us",
    description: "Collect name, email, phone, and a message",
    icon: <MessageSquareIcon className="size-5" />,
    formTitle: "Contact Us",
    formDescription: "We'd love to hear from you. Fill out the form below and we'll get back to you shortly.",
    fields: () => [
      { id: fieldId(), label: "Full name", type: "short_text", required: true, placeholder: "John Doe" },
      { id: fieldId(), label: "Email address", type: "email", required: true, placeholder: "john@company.com" },
      { id: fieldId(), label: "Phone number", type: "phone", required: false, placeholder: "+91 98765 43210" },
      { id: fieldId(), label: "Your message", type: "long_text", required: true, placeholder: "How can we help you?", description: "Please describe your inquiry in detail" },
    ],
  },
  {
    id: "lead-gen",
    title: "Lead Generation",
    description: "Qualify leads with company details and budget",
    icon: <TargetIcon className="size-5" />,
    formTitle: "Get in Touch",
    formDescription: "Interested in our services? Tell us about your needs and we'll reach out.",
    fields: () => [
      { id: fieldId(), label: "Full name", type: "short_text", required: true, placeholder: "Jane Smith" },
      { id: fieldId(), label: "Work email", type: "email", required: true, placeholder: "jane@company.com" },
      { id: fieldId(), label: "Company name", type: "short_text", required: true, placeholder: "Acme Inc." },
      { id: fieldId(), label: "Phone number", type: "phone", required: false, placeholder: "+91 98765 43210" },
      { id: fieldId(), label: "Budget range", type: "dropdown", required: true, options: ["Under ₹1L", "₹1L - ₹5L", "₹5L - ₹20L", "₹20L+"], description: "Approximate budget for this project" },
      { id: fieldId(), label: "How did you hear about us?", type: "dropdown", required: false, options: ["Google search", "Social media", "Referral", "Blog/Article", "Other"] },
    ],
  },
  {
    id: "feedback",
    title: "Customer Feedback",
    description: "Ratings, open feedback, and recommendations",
    icon: <StarIcon className="size-5" />,
    formTitle: "Customer Feedback",
    formDescription: "Your feedback helps us improve. It only takes a minute.",
    fields: () => [
      { id: fieldId(), label: "How would you rate your experience?", type: "rating", required: true, description: "1 = Poor, 5 = Excellent" },
      { id: fieldId(), label: "What did you like the most?", type: "long_text", required: false, placeholder: "Tell us what went well..." },
      { id: fieldId(), label: "What can we improve?", type: "long_text", required: false, placeholder: "Any suggestions for improvement..." },
      { id: fieldId(), label: "Would you recommend us to others?", type: "yes_no", required: true },
    ],
  },
  {
    id: "job-application",
    title: "Job Application",
    description: "Collect applicant info, resume, and cover letter",
    icon: <FileTextIcon className="size-5" />,
    formTitle: "Job Application",
    formDescription: "Apply for a position at our company. Please fill in your details below.",
    fields: () => [
      { id: fieldId(), label: "Full name", type: "short_text", required: true, placeholder: "Your full name" },
      { id: fieldId(), label: "Email address", type: "email", required: true, placeholder: "you@email.com" },
      { id: fieldId(), label: "Phone number", type: "phone", required: true, placeholder: "+91 98765 43210" },
      { id: fieldId(), label: "LinkedIn profile", type: "url", required: false, placeholder: "https://linkedin.com/in/...", description: "Share your LinkedIn profile URL" },
      { id: fieldId(), label: "Resume", type: "file", required: true, description: "Upload your resume (PDF preferred)" },
      { id: fieldId(), label: "Cover letter", type: "long_text", required: false, placeholder: "Tell us why you're interested in this role...", description: "Optional but recommended" },
    ],
  },
  {
    id: "event",
    title: "Event Registration",
    description: "Name, email, company, and dietary preferences",
    icon: <UsersIcon className="size-5" />,
    formTitle: "Event Registration",
    formDescription: "Register for our upcoming event. We look forward to seeing you there!",
    fields: () => [
      { id: fieldId(), label: "Full name", type: "short_text", required: true, placeholder: "Your name" },
      { id: fieldId(), label: "Email address", type: "email", required: true, placeholder: "you@company.com" },
      { id: fieldId(), label: "Company / Organization", type: "short_text", required: false, placeholder: "Your company name" },
      { id: fieldId(), label: "Dietary requirements", type: "dropdown", required: false, options: ["None", "Vegetarian", "Vegan", "Gluten-free", "Other"], description: "Let us know if you have any dietary restrictions" },
      { id: fieldId(), label: "Any questions for the speakers?", type: "long_text", required: false, placeholder: "Submit questions ahead of time..." },
    ],
  },
]

export function FormTemplateDialog({
  open,
  onOpenChange,
  onSelect,
  creating,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (template: { title: string; description: string; fields: TemplateField[] }) => void
  creating: boolean
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  function handleSelect(template: FormTemplate) {
    setSelectedId(template.id)
    onSelect({
      title: template.formTitle,
      description: template.formDescription,
      fields: template.fields(),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a new form</DialogTitle>
          <DialogDescription>Choose a template to get started quickly, or start from scratch.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TEMPLATES.map((template) => {
            const isSelected = selectedId === template.id && creating
            return (
              <button
                key={template.id}
                type="button"
                disabled={creating}
                onClick={() => handleSelect(template)}
                className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {isSelected ? <LoaderIcon className="size-3.5 animate-spin" /> : template.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{template.title}</p>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
