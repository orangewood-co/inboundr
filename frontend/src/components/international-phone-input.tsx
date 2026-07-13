import { useMemo, useState } from "react"
import {
  getCountries,
  getCountryCallingCode,
  type Country,
  type Value,
} from "react-phone-number-input"
import PhoneInput from "react-phone-number-input/input"
import flags from "react-phone-number-input/flags"
import labels from "react-phone-number-input/locale/en"
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const countries = getCountries()
  .map((country) => ({
    country,
    label: labels[country],
    callingCode: getCountryCallingCode(country),
  }))
  .sort((a, b) => a.label.localeCompare(b.label))

export function InternationalPhoneInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const [country, setCountry] = useState<Country>("IN")
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [search, setSearch] = useState("")
  const selectedCountry = countries.find((option) => option.country === country)!
  const Flag = flags[country]
  const filteredCountries = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return countries
    return countries.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.callingCode.includes(query) ||
        option.country.toLowerCase().includes(query),
    )
  }, [search])

  function selectCountry(nextCountry: Country) {
    if (nextCountry !== country) {
      setCountry(nextCountry)
      onChange("")
    }
    setCountryPickerOpen(false)
    setSearch("")
  }

  return (
    <div className="international-phone-input">
      <Popover
        open={countryPickerOpen}
        onOpenChange={(open) => {
          setCountryPickerOpen(open)
          if (!open) setSearch("")
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-full shrink-0 gap-2 rounded-r-none border-r px-2.5 hover:bg-muted/60"
            aria-label={`Change country, currently ${selectedCountry.label}`}
          >
            {Flag && (
              <span className="flex w-5 overflow-hidden rounded-sm [&_svg]:h-auto [&_svg]:w-full">
                <Flag title={selectedCountry.label} />
              </span>
            )}
            <ChevronDownIcon className="size-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 p-0"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="border-b p-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search country or code"
                className="pl-8"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {filteredCountries.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No countries found
              </p>
            ) : (
              filteredCountries.map((option) => {
                const OptionFlag = flags[option.country]
                const selected = option.country === country
                return (
                  <button
                    key={option.country}
                    type="button"
                    onClick={() => selectCountry(option.country)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none",
                      selected && "bg-accent/60",
                    )}
                  >
                    <span className="flex w-5 shrink-0 overflow-hidden rounded-sm [&_svg]:h-auto [&_svg]:w-full">
                      {OptionFlag && <OptionFlag title={option.label} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <span className="text-muted-foreground">+{option.callingCode}</span>
                    <CheckIcon
                      className={cn("size-4 shrink-0", selected ? "opacity-100" : "opacity-0")}
                    />
                  </button>
                )
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      <span className="shrink-0 pl-3 text-sm text-muted-foreground">
        +{selectedCountry.callingCode}
      </span>
      <PhoneInput
        id={id}
        country={country}
        className="h-full min-w-0 flex-1 border-0 bg-transparent px-2.5 py-1 text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
        value={(value || undefined) as Value | undefined}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        placeholder="Contact number"
        autoComplete="tel"
      />
    </div>
  )
}
