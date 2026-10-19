import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const baseClasses =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform,background-color] duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const variantClasses = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
  outline: "border border-input bg-card hover:bg-secondary",
  ghost: "hover:bg-secondary",
  destructive:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const sizeClasses = {
  default: "h-11 px-4 md:h-10",
  sm: "h-9 px-3",
  icon: "h-9 w-9",
};

export function buttonStyles(
  variant: keyof typeof variantClasses = "default",
  size: keyof typeof sizeClasses = "default",
) {
  return cn(baseClasses, variantClasses[variant], sizeClasses[size]);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantClasses;
  size?: keyof typeof sizeClasses;
};

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonStyles(variant, size), className)} {...props} />
  );
}
