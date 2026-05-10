import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-[14px] text-[#0A0A0A] transition-all outline-none placeholder:text-[#D1D5DB] focus-visible:bg-white focus-visible:border-[#111827] focus-visible:ring-1 focus-visible:ring-[#111827] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-400 aria-invalid:ring-1 aria-invalid:ring-red-400",
        className
      )}
      {...props}
    />
  )
}

export { Input }
