import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create an Account",
  description: "Create your Aurena Nails account to book appointments, save favourite designs and track your visits.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <div>
      <p className="eyebrow">Join the studio</p>
      <h1 className="mt-3 text-3xl">Create your account</h1>
      <p className="mt-3 text-sm text-muted">
        One short form and you can book appointments, build a wishlist of designs, and collect your favourites.
      </p>

      <div className="mt-8">
        <RegisterForm />
      </div>
    </div>
  );
}
