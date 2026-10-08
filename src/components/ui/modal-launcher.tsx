"use client";

/**
 * A button that opens a modal dialog. Used for the small "how it works" style
 * explanations that would otherwise clutter a page with static text.
 */
import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/interactive";

export function ModalLauncher({
  label,
  title,
  children,
  buttonClassName = "btn-outline btn-sm",
  icon,
}: {
  label: string;
  title: string;
  children: ReactNode;
  buttonClassName?: string;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => setOpen(true)}>
        {icon}
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </Modal>
    </>
  );
}
