"use client"

import { Check } from "lucide-react"
import {
  Collection as AriaCollection,
  Header as AriaHeader,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  ListBoxItemProps as AriaListBoxItemProps,
  ListBoxProps as AriaListBoxProps,
  Section as AriaSection,
  composeRenderProps,
} from "react-aria-components"

import { cn } from "@/lib/utils"

const ListBoxSection = AriaSection

const ListBoxCollection = AriaCollection

function ListBox<T extends object>({
  className,
  ...props
}: AriaListBoxProps<T>) {
  return (
    <AriaListBox
      className={composeRenderProps(className, (className) =>
        cn(
          className,
          "group overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none",
          /* Empty */
          "data-[empty]:p-6 data-[empty]:text-center data-[empty]:text-sm"
        )
      )}
      {...props}
    />
  )
}

const ListBoxItem = <T extends object>({
  className,
  children,
  ...props
}: AriaListBoxItemProps<T>) => {
  return (
    <AriaListBoxItem
      textValue={
        props.textValue || (typeof children === "string" ? children : undefined)
      }
      className={composeRenderProps(className, (className) =>
        cn(
          // Base: always reserve 32px left for checkmark so text never shifts
          "relative flex w-full cursor-default select-none items-center gap-2 pl-8 pr-3 py-2.5 text-sm font-medium outline-none rounded-lg",
          // Separator between items via border-bottom (except last)
          "border-b border-border/40 last:border-b-0",
          /* Disabled */
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          /* Focused / Hovered — use brand tint */
          "data-[focused]:bg-primary/8 data-[focused]:text-primary",
          "data-[hovered]:bg-muted data-[hovered]:text-foreground",
          /* Selected item gets a stronger tint */
          "data-[selected]:bg-primary/10 data-[selected]:text-primary",
          className
        )
      )}
      {...props}
    >
      {composeRenderProps(children, (children, renderProps) => (
        <>
          {/* Checkmark slot — always present to prevent layout shift */}
          <span className="absolute left-2.5 flex size-4 items-center justify-center shrink-0">
            {renderProps.isSelected && (
              <Check className="size-3.5 text-primary" strokeWidth={2.5} />
            )}
          </span>
          <span className="flex-1 leading-snug">{children}</span>
        </>
      ))}
    </AriaListBoxItem>
  )
}

function ListBoxHeader({
  className,
  ...props
}: React.ComponentProps<typeof AriaHeader>) {
  return (
    <AriaHeader
      className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
      {...props}
    />
  )
}

export {
  ListBox,
  ListBoxItem,
  ListBoxHeader,
  ListBoxSection,
  ListBoxCollection,
}
