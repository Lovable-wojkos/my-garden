import React, { useState } from "react";
import { Mail, Send } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { pl } from "@/lib/copy/pl";

interface Props {
  serverError?: string | null;
}

export default function SignInForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{ email?: string }>({});

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) {
      next.email = pl.auth.errors.emailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = pl.auth.errors.emailInvalid;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    if (!validate()) {
      e.preventDefault();
      return;
    }
    setPending(true);
  }

  return (
    <form method="POST" action="/api/auth/magic-link" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label={pl.auth.emailLabel}
        value={email}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder={pl.auth.emailPlaceholder}
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <ServerError message={serverError} />

      <SubmitButton pending={pending} pendingText={pl.auth.magicLinkSendPending} icon={<Send className="size-4" />}>
        {pl.auth.magicLinkSendButton}
      </SubmitButton>
    </form>
  );
}
