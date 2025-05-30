
"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check, Minus } from "lucide-react" // Import Minus

import { cn } from "@/lib/utils"

// Define props for our custom Checkbox, allowing 'checked' to be boolean or 'indeterminate'
interface CheckboxProps extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'checked'> {
  checked?: boolean | 'indeterminate';
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps // Use the modified props
>(({ className, checked, ...props }, ref) => ( // Destructure checked explicitly
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground", // Added explicit styling for data-state=indeterminate
      className
    )}
    {...props} // Spread other props like onCheckedChange, disabled
    checked={checked} // Pass the checked prop (which can be boolean | 'indeterminate')
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      {/* Conditionally render Minus or Check icon */}
      {checked === 'indeterminate' ? (
        <Minus className="h-4 w-4" />
      ) : (
        <Check className="h-4 w-4" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
