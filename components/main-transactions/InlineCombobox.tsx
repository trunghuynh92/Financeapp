"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Option {
  value: string
  label: string
}

interface InlineComboboxProps {
  value: string
  options: Option[]
  onSelect: (value: string) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  onCreate?: (prefillName?: string) => void
  createLabel?: string
}

export function InlineCombobox({
  value,
  options,
  onSelect,
  placeholder = "Select...",
  emptyText = "No results found",
  disabled = false,
  className,
  onCreate,
  createLabel = "Create new...",
}: InlineComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)

  // Detect /create command
  const createMatch = searchValue.match(/^\/create\s+(.+)$/i)
  const isCreateCommand = createMatch !== null

  // Reset search when closing
  React.useEffect(() => {
    if (!open) {
      setSearchValue("")
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-8 text-sm", className)}
          disabled={disabled}
        >
          {selectedOption?.label || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={onCreate ? `Search or type /create [name]` : `Search...`}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {isCreateCommand && onCreate ? (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onCreate(createMatch![1].trim())
                    setOpen(false)
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create &ldquo;{createMatch![1].trim()}&rdquo;
                </CommandItem>
              </CommandGroup>
            ) : (
              <>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {options
                    .filter((option) =>
                      searchValue
                        ? option.label.toLowerCase().includes(searchValue.toLowerCase())
                        : true
                    )
                    .map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => {
                          onSelect(option.value)
                          setOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === option.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    ))}
                </CommandGroup>
                {onCreate && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          onCreate()
                          setOpen(false)
                        }}
                        className="text-primary"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {createLabel}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
