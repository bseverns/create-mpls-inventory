"use client";
import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

// A submit button
function SubmitButton({
  children,
  pendingText,
  destructive,
}: {
  children: ReactNode;
  pendingText: string;
  destructive?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={destructive ? "destructive" : "default"}
      disabled={pending}
    >
      {pending ? pendingText : children}
    </Button>
  );
}

type DialogFormProps = {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  submitText: string;
  pendingText?: string;
  destructive?: boolean;
  // The toast shown after the action works
  successMessage?: (formData: FormData) => string;
  children?: ReactNode;
};

// The form inside a pop-up
function DialogForm({
  action,
  onClose,
  submitText,
  pendingText = "Saving…",
  destructive,
  successMessage,
  children,
}: DialogFormProps & { onClose: () => void }) {
  const [errorMessage, setErrorMessage] = useState("");

  async function submitForm(formData: FormData) {
    const result = await action(formData);
    if (result && result.error) {
      setErrorMessage(result.error);
      return;
    }
    onClose();
    if (successMessage) toast.success(successMessage(formData));
  }

  return (
    <form className="mt-4 grid gap-5" action={submitForm}>
      {children}
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <SubmitButton pendingText={pendingText} destructive={destructive}>
          {submitText}
        </SubmitButton>
      </div>
    </form>
  );
}

// A pop-up with a form, a Cancel button and a submit button
export function FormDialog({
  title,
  description,
  isOpen,
  onOpenChange,
  wide,
  ...formProps
}: DialogFormProps & {
  title: string;
  description?: ReactNode;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  wide?: boolean;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={wide ? "max-w-xl" : undefined}>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
        <DialogForm {...formProps} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
