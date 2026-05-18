"use client"


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

import { cn, glass } from "@/lib/utils"

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
          glass.light,
          "group overflow-auto rounded-md border p-1 text-popover-foreground shadow-md outline-none",
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
          "flex w-full cursor-default select-none items-center px-3 py-2.5 text-sm font-medium outline-none rounded-lg",
          // Separator between items (except last)
          "border-b border-border/40 last:border-b-0",
          /* Disabled */
          "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          /* Keyboard focus (visible only) / Pointer hover.
             Using data-[focus-visible] instead of data-[focused] avoids the
             "sticky blue" effect where the last hovered item retains its
             focus highlight after the pointer leaves the dropdown. */
          "data-[focus-visible]:bg-primary/8 data-[focus-visible]:text-primary",
          "data-[hovered]:bg-muted data-[hovered]:text-foreground",
          /* Selected */
          "data-[selected]:bg-primary/10 data-[selected]:text-primary data-[selected]:font-semibold",
          className
        )
      )}
      {...props}
    >
      {composeRenderProps(children, (children) => (
        <span className="flex-1 leading-snug">{children}</span>
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
