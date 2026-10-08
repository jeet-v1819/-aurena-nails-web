"use client";

/**
 * Contact form: React Hook Form + the shared Zod schema, submitted through the
 * `submitContactMessageAction` server action (which validates again on the
 * server and stores the message in the database).
 */
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { submitContactMessageAction } from "@/server/actions/customer";
import { contactSchema } from "@/validators/customer";
import { Alert } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import type { z } from "zod";

type ContactFormValues = z.input<typeof contactSchema>;

export function ContactForm({ defaultName = "", defaultEmail = "", defaultMobile = "" }: { defaultName?: string; defaultEmail?: string; defaultMobile?: string }) {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: defaultName,
      email: defaultEmail,
      mobile: defaultMobile,
      subject: "",
      message: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await submitContactMessageAction(values);

    if (result.ok) {
      notifyResult(result);
      setSent(true);
      reset({ name: defaultName, email: defaultEmail, mobile: defaultMobile, subject: "", message: "" });
      return;
    }

    notifyResult(result);
    setFormError(result.error ?? null);

    // Surface server-side field errors on the matching inputs.
    for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
      if (messages?.length) {
        setError(field as keyof ContactFormValues, { type: "server", message: messages[0] });
      }
    }
  });

  if (sent) {
    return (
      <Alert tone="success" title="Message received">
        <p>
          Thank you for writing to us — your message is with the studio and we usually reply within one working day. For
          anything urgent, please call or WhatsApp us.
        </p>
        <button type="button" className="btn-outline btn-sm mt-4" onClick={() => setSent(false)}>
          Send another message
        </button>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="label">
            Your name <span className="text-rosegold">*</span>
          </label>
          <input id="contact-name" className="input mt-2" autoComplete="name" {...register("name")} />
          {errors.name ? <p className="field-error">{errors.name.message}</p> : null}
        </div>

        <div>
          <label htmlFor="contact-mobile" className="label">
            Mobile number <span className="text-rosegold">*</span>
          </label>
          <input
            id="contact-mobile"
            className="input mt-2"
            inputMode="tel"
            placeholder="+91 98765 43210"
            autoComplete="tel"
            {...register("mobile")}
          />
          {errors.mobile ? <p className="field-error">{errors.mobile.message}</p> : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-email" className="label">
            Email address <span className="text-rosegold">*</span>
          </label>
          <input id="contact-email" type="email" className="input mt-2" autoComplete="email" {...register("email")} />
          {errors.email ? <p className="field-error">{errors.email.message}</p> : null}
        </div>

        <div>
          <label htmlFor="contact-subject" className="label">
            Subject <span className="text-rosegold">*</span>
          </label>
          <input
            id="contact-subject"
            className="input mt-2"
            placeholder="Bridal party booking, design enquiry…"
            {...register("subject")}
          />
          {errors.subject ? <p className="field-error">{errors.subject.message}</p> : null}
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="label">
          Message <span className="text-rosegold">*</span>
        </label>
        <textarea
          id="contact-message"
          className="textarea mt-2 min-h-[150px]"
          placeholder="Tell us what you have in mind — dates, number of people, inspiration…"
          {...register("message")}
        />
        {errors.message ? <p className="field-error">{errors.message.message}</p> : null}
      </div>

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {isSubmitting ? "Sending…" : "Send message"}
      </button>

      <p className="text-xs text-muted">
        By sending this message you agree that we may contact you about your enquiry. We never share your details.
      </p>
    </form>
  );
}
