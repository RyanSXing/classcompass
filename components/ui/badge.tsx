import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
export function Badge({tone="neutral",className,...props}:ComponentProps<"span">&{tone?:"neutral"|"violet"|"green"|"amber"|"red"|"aqua"}) {return <span className={cn("badge",`badge-${tone}`,className)} {...props}/>;}
