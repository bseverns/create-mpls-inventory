import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = ({
  className,
  ...p
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("rounded-lg border bg-card text-card-foreground", className)}
    {...p}
  />
);
export const CardContent = ({
  className,
  ...p
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-4", className)} {...p} />
);
export const Badge = ({
  className,
  ...p
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground",
      className,
    )}
    {...p}
  />
);
