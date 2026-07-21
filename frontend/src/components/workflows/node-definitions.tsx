import type { LucideIcon } from "lucide-react"
import {
  ArchiveIcon,
  BellIcon,
  ClipboardListIcon,
  FileSearchIcon,
  FileTextIcon,
  MailCheckIcon,
  MailIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  TimerIcon,
} from "lucide-react"

export type WorkflowNodeCategory = "trigger" | "action" | "logic"

export interface WorkflowFieldOption {
  value: string
  label: string
}

export interface WorkflowFieldDefinition {
  key: string
  label: string
  type: "text" | "textarea" | "number" | "select" | "form_select"
  placeholder?: string
  options?: WorkflowFieldOption[]
  supportsVariables?: boolean
  defaultValue?: string | number
  required?: boolean
}

export interface WorkflowOutputHandle {
  id: string | null
  label?: string
}

export interface WorkflowNodeDefinition {
  type: string
  label: string
  description: string
  category: WorkflowNodeCategory
  icon: LucideIcon
  hasInput: boolean
  outputs: WorkflowOutputHandle[]
  fields: WorkflowFieldDefinition[]
}

export interface TemplateVariable {
  token: string
  label: string
}

/** Action node types that operate on the triggering RFQ. */
export const RFQ_ONLY_NODE_TYPES = ["action.place_order", "action.archive_rfq"]

export const RFQ_TEMPLATE_VARIABLES: TemplateVariable[] = [
  { token: "{{rfq.customer.name}}", label: "Customer name" },
  { token: "{{rfq.customer.company}}", label: "Customer company" },
  { token: "{{rfq.customer.email}}", label: "Customer email" },
  { token: "{{rfq.subject}}", label: "Email subject" },
  { token: "{{rfq.quoteNumber}}", label: "Quote number" },
  { token: "{{rfq.productCount}}", label: "Product count" },
  { token: "{{rfq.quoteTotal}}", label: "Quote total" },
  { token: "{{rfq.link}}", label: "RFQ link" },
]

export const FORM_TEMPLATE_VARIABLES: TemplateVariable[] = [
  { token: "{{form.title}}", label: "Form title" },
  { token: "{{form.link}}", label: "Form link" },
]

export const GENERIC_TEMPLATE_VARIABLES: TemplateVariable[] = [
  { token: "{{workflow.name}}", label: "Workflow name" },
  { token: "{{organization.name}}", label: "Organization name" },
]

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  ...RFQ_TEMPLATE_VARIABLES,
  ...GENERIC_TEMPLATE_VARIABLES,
]

export const NODE_DEFINITIONS: WorkflowNodeDefinition[] = [
  {
    type: "trigger.rfq_identified",
    label: "RFQ Identified",
    description: "Runs when an incoming email is identified as an RFQ.",
    category: "trigger",
    icon: FileSearchIcon,
    hasInput: false,
    outputs: [{ id: null }],
    fields: [],
  },
  {
    type: "trigger.rfq_draft_saved",
    label: "Quote Drafted",
    description: "Runs when an RFQ quote draft is saved.",
    category: "trigger",
    icon: FileTextIcon,
    hasInput: false,
    outputs: [{ id: null }],
    fields: [],
  },
  {
    type: "trigger.rfq_order_placed",
    label: "Order Placed",
    description: "Runs when a quote number is set and the RFQ is processed.",
    category: "trigger",
    icon: ShoppingCartIcon,
    hasInput: false,
    outputs: [{ id: null }],
    fields: [],
  },
  {
    type: "trigger.rfq_quote_sent",
    label: "Quote Sent",
    description: "Runs when the quote reply is sent to the customer.",
    category: "trigger",
    icon: MailCheckIcon,
    hasInput: false,
    outputs: [{ id: null }],
    fields: [],
  },
  {
    type: "trigger.rfq_archived",
    label: "RFQ Archived",
    description: "Runs when an RFQ is archived.",
    category: "trigger",
    icon: ArchiveIcon,
    hasInput: false,
    outputs: [{ id: null }],
    fields: [],
  },
  {
    type: "trigger.form_submitted",
    label: "Form Submitted",
    description: "Runs when someone submits the selected form.",
    category: "trigger",
    icon: ClipboardListIcon,
    hasInput: false,
    outputs: [{ id: null }],
    fields: [
      {
        key: "formId",
        label: "Form",
        type: "form_select",
        required: true,
      },
    ],
  },
  {
    type: "action.send_email",
    label: "Send Email",
    description: "Sends an email to any address.",
    category: "action",
    icon: MailIcon,
    hasInput: true,
    outputs: [{ id: null }],
    fields: [
      {
        key: "to",
        label: "To",
        type: "text",
        placeholder: "person@company.com",
        supportsVariables: true,
        required: true,
      },
      {
        key: "subject",
        label: "Subject",
        type: "text",
        placeholder: "New RFQ from {{rfq.customer.company}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "body",
        label: "Body",
        type: "textarea",
        placeholder: "An RFQ was received from {{rfq.customer.name}}…",
        supportsVariables: true,
      },
    ],
  },
  {
    type: "action.request_approval",
    label: "Request Approval",
    description: "Emails approve/reject links and waits for the decision.",
    category: "action",
    icon: ShieldCheckIcon,
    hasInput: true,
    outputs: [
      { id: "approved", label: "Approved" },
      { id: "rejected", label: "Rejected" },
    ],
    fields: [
      {
        key: "to",
        label: "Approver email",
        type: "text",
        placeholder: "manager@company.com",
        supportsVariables: true,
        required: true,
      },
      {
        key: "subject",
        label: "Subject",
        type: "text",
        placeholder: "Approval needed: {{rfq.subject}}",
        supportsVariables: true,
      },
      {
        key: "message",
        label: "Message",
        type: "textarea",
        placeholder: "Approve the order for {{rfq.customer.company}}?",
        supportsVariables: true,
      },
    ],
  },
  {
    type: "action.place_order",
    label: "Place Order",
    description: "Marks the RFQ as processed with a quote number.",
    category: "action",
    icon: ShoppingCartIcon,
    hasInput: true,
    outputs: [{ id: null }],
    fields: [
      {
        key: "quoteNumber",
        label: "Quote number (blank = auto)",
        type: "text",
        placeholder: "Auto-generated when empty",
        supportsVariables: true,
      },
    ],
  },
  {
    type: "action.archive_rfq",
    label: "Archive RFQ",
    description: "Archives the RFQ.",
    category: "action",
    icon: ArchiveIcon,
    hasInput: true,
    outputs: [{ id: null }],
    fields: [],
  },
  {
    type: "action.notify",
    label: "Notify in App",
    description: "Sends an in-app notification to the RFQ owner.",
    category: "action",
    icon: BellIcon,
    hasInput: true,
    outputs: [{ id: null }],
    fields: [
      {
        key: "title",
        label: "Title",
        type: "text",
        placeholder: "RFQ from {{rfq.customer.company}}",
        supportsVariables: true,
        required: true,
      },
      {
        key: "body",
        label: "Body",
        type: "textarea",
        placeholder: "Optional details…",
        supportsVariables: true,
      },
    ],
  },
  {
    type: "logic.delay",
    label: "Delay",
    description: "Waits before running the next step.",
    category: "logic",
    icon: TimerIcon,
    hasInput: true,
    outputs: [{ id: null }],
    fields: [
      {
        key: "amount",
        label: "Amount",
        type: "number",
        placeholder: "10",
        defaultValue: 10,
        required: true,
      },
      {
        key: "unit",
        label: "Unit",
        type: "select",
        defaultValue: "minutes",
        options: [
          { value: "minutes", label: "Minutes" },
          { value: "hours", label: "Hours" },
          { value: "days", label: "Days" },
        ],
      },
    ],
  },
]

export const NODE_DEFINITION_MAP = new Map(
  NODE_DEFINITIONS.map((definition) => [definition.type, definition])
)

export const CATEGORY_STYLES: Record<
  WorkflowNodeCategory,
  {
    /** Solid icon chip (canvas card header + palette rows). */
    iconSolid: string
    /** Faint tint behind the card header. */
    headerTint: string
    /** Source/target connection dots. */
    handle: string
    /** Ring color when the node is selected. */
    selectedRing: string
    /** MiniMap node fill. */
    minimapColor: string
  }
> = {
  trigger: {
    iconSolid: "bg-amber-500 text-white",
    headerTint: "bg-amber-500/8 dark:bg-amber-400/10",
    handle: "bg-amber-500!",
    selectedRing: "ring-amber-500/45 border-amber-500/60",
    minimapColor: "#f59e0b",
  },
  action: {
    iconSolid: "bg-sky-500 text-white",
    headerTint: "bg-sky-500/8 dark:bg-sky-400/10",
    handle: "bg-sky-500!",
    selectedRing: "ring-sky-500/45 border-sky-500/60",
    minimapColor: "#0ea5e9",
  },
  logic: {
    iconSolid: "bg-violet-500 text-white",
    headerTint: "bg-violet-500/8 dark:bg-violet-400/10",
    handle: "bg-violet-500!",
    selectedRing: "ring-violet-500/45 border-violet-500/60",
    minimapColor: "#8b5cf6",
  },
}

/** True when every required field has a value. */
export function isNodeConfigComplete(
  definition: WorkflowNodeDefinition,
  config: Record<string, unknown>
): boolean {
  return definition.fields
    .filter((field) => field.required)
    .every((field) => {
      const value = config[field.key]
      return value != null && String(value).trim() !== ""
    })
}

export function defaultConfigForNode(type: string): Record<string, unknown> {
  const definition = NODE_DEFINITION_MAP.get(type)
  if (!definition) return {}
  const config: Record<string, unknown> = {}
  for (const field of definition.fields) {
    if (field.defaultValue !== undefined) config[field.key] = field.defaultValue
  }
  return config
}
