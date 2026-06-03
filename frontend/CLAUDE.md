I am using bun.

# Frontend conventions

## UI text capitalization: smart Title Case

All UI chrome uses **smart Title Case** for consistency. When adding or editing
user-facing text, follow these rules.

### The rule

- Capitalize the first letter of every word, EXCEPT minor words, which stay
  lowercase unless they are the first or last word.
- Minor words kept lowercase: `a, an, and, as, at, but, by, for, from, in,
  into, nor, of, off, on, onto, or, per, the, to, up, via, vs, with`.
- Capitalize verbs and "to be" forms (`Is`, `Are`, `Be`), and phrasal-verb
  particles in labels (`Sign Up`, `Sign In`, `Set Up`, `Log Out`, `Write Off`).
- Preserve existing ALL-CAPS acronyms and brand / proper nouns exactly:
  `RFQ, CSV, GST, HSN, QR, PDF, UPI, URL, AM, PM, OS, Excel, Gmail, Drive,
  LinkedIn, OpenStreetMap, BTSA, Inboundr` (and the lowercase `inboundr.` brand
  mark — never recase brand names).

Examples:

- `Add Product`, `Edit Customer`, `Create Invoice`, `Save Changes`
- `Back to Dashboard`, `Shared with Me`, `Set Up the Workspace`
- `Create a New Form`, `Invited or Added Users`, `No Products in the Catalog Yet`
- `Do Not Import`, `This Folder Is Empty`, `Archive RFQ` (unchanged)

### Apply Title Case to (UI chrome)

- Buttons / CTAs and link-buttons (`<Button>`, link labels)
- Headings & page/section titles (`h1`–`h3`, `CardTitle`, stepper/section
  titles, prominent `font-semibold` section labels)
- Dialog & sheet titles (`DialogTitle`, `SheetTitle`, `AlertDialogTitle`)
- Tabs (`TabsTrigger`)
- Table column headers (`TableHead` / `th`)
- Menu & option labels (`DropdownMenuItem`, `DropdownMenuLabel`, `SelectItem`)
- Nav items, breadcrumbs, and empty-state titles ("No Employees Found")

### Do NOT title-case (leave in sentence case)

- Descriptions / helper text (`DialogDescription`, `CardDescription`, muted
  paragraphs)
- Placeholders, and `<input>` / `<textarea>` content
- Form field labels (`<Label>`, `<FieldLabel>`) — keep these sentence case
- Tooltips (`TooltipContent`) and toast / validation messages
- `sr-only` screen-reader text and `aria-label`s
- Status badges that reflect data/enum state (e.g. `Top seller`, `Live`)
- Marketing taglines and any full sentence ending in terminal punctuation
  (`.?!`)
- Dynamic values (`{variables}`), enum `value=""` props, URLs, and document /
  meta `<title>` tags

### Notes

- Edit string literals directly; do not wrap labels in a runtime
  `toTitleCase()` helper (it would mangle acronyms and bloat diffs).
- For dynamically rendered enum labels (e.g. invoice statuses), prefer a
  `className="capitalize"` on the rendering element so the picker matches its
  badge.
