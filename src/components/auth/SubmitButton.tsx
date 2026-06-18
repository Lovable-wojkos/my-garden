import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  pendingText: string;
  icon: ReactNode;
  children: ReactNode;
  pending?: boolean;
}

export function SubmitButton({ pendingText, icon, children, pending: pendingOverride }: SubmitButtonProps) {
  const { pending: formPending } = useFormStatus();
  const pending = pendingOverride ?? formPending;

  return (
    <Button type="submit" disabled={pending} className="min-h-11 w-full">
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
          {pendingText}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {icon}
          {children}
        </span>
      )}
    </Button>
  );
}
