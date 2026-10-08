"use client";

/**
 * Profile details (name, mobile, avatar) and password change.
 * The avatar is uploaded through the shared uploader, so the database only ever
 * stores the URL, public id and file metadata.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImageUp, KeyRound, Loader2, Save, Trash2 } from "lucide-react";
import { changePasswordAction, updateProfileAction } from "@/server/actions/customer";
import { changePasswordSchema, profileSchema } from "@/validators/customer";
import { ImageUploader, type UploadedFile } from "@/components/ui/image-uploader";
import { PasswordHints, PasswordInput } from "@/components/auth/password-input";
import { Alert, Divider } from "@/components/ui/primitives";
import { notifyResult } from "@/components/ui/toaster";
import { initials } from "@/lib/format";
import type { z } from "zod";

type ProfileValues = z.input<typeof profileSchema>;
type PasswordValues = z.input<typeof changePasswordSchema>;

export function ProfileForm({
  customer,
}: {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    avatarUrl: string | null;
    avatarPublicId: string | null;
  };
}) {
  const router = useRouter();
  const [avatar, setAvatar] = useState<{ url: string; publicId: string | null } | null>(
    customer.avatarUrl ? { url: customer.avatarUrl, publicId: customer.avatarPublicId } : null
  );
  const [showUploader, setShowUploader] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      mobile: customer.mobile,
      avatarUrl: customer.avatarUrl ?? "",
      avatarPublicId: customer.avatarPublicId ?? "",
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
  });

  const newPassword = passwordForm.watch("password") ?? "";

  const saveProfile = profileForm.handleSubmit(async (values) => {
    setProfileError(null);
    const result = await updateProfileAction({
      ...values,
      avatarUrl: avatar?.url ?? "",
      avatarPublicId: avatar?.publicId ?? "",
    });

    if (!result.ok) {
      notifyResult(result);
      setProfileError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.length) profileForm.setError(field as keyof ProfileValues, { type: "server", message: messages[0] });
      }
      return;
    }

    notifyResult(result);
    router.refresh();
  });

  const savePassword = passwordForm.handleSubmit(async (values) => {
    setPasswordError(null);
    setPasswordDone(false);
    const result = await changePasswordAction(values);

    if (!result.ok) {
      notifyResult(result);
      setPasswordError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (messages?.length) passwordForm.setError(field as keyof PasswordValues, { type: "server", message: messages[0] });
      }
      return;
    }

    notifyResult(result);
    setPasswordDone(true);
    passwordForm.reset({ currentPassword: "", password: "", confirmPassword: "" });
  });

  const onUploaded = (files: UploadedFile[]) => {
    const file = files[0];
    if (!file) return;
    setAvatar({ url: file.url, publicId: file.publicId });
    profileForm.setValue("avatarUrl", file.url);
    profileForm.setValue("avatarPublicId", file.publicId ?? "");
    setShowUploader(false);
  };

  return (
    <div className="space-y-8">
      {/* --------------------------------------------------------- details */}
      <section className="card p-6">
        <h2 className="font-display text-xl">Personal details</h2>
        <p className="mt-1 text-sm text-muted">Your name and mobile number are used only for appointment updates.</p>

        <form onSubmit={saveProfile} noValidate className="mt-6 space-y-5">
          {profileError ? <Alert tone="danger">{profileError}</Alert> : null}

          <div className="flex flex-wrap items-center gap-5">
            <span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blush text-xl font-medium text-rosegold-dark">
              {avatar ? (
                <Image src={avatar.url} alt="Your profile picture" fill sizes="80px" className="object-cover" />
              ) : (
                initials(profileForm.watch("firstName") ?? "", profileForm.watch("lastName") ?? "")
              )}
            </span>

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-outline btn-sm" onClick={() => setShowUploader((value) => !value)}>
                <ImageUp size={15} /> {avatar ? "Change photo" : "Add photo"}
              </button>
              {avatar ? (
                <button
                  type="button"
                  className="btn-ghost btn-sm text-danger"
                  onClick={() => {
                    setAvatar(null);
                    profileForm.setValue("avatarUrl", "");
                    profileForm.setValue("avatarPublicId", "");
                  }}
                >
                  <Trash2 size={15} /> Remove
                </button>
              ) : null}
            </div>
          </div>

          {showUploader ? (
            <ImageUploader kind="image" folder="avatars" label="Drop a photo here or browse" onUploaded={onUploaded} />
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-first" className="label">
                First name
              </label>
              <input id="profile-first" className="input mt-2" {...profileForm.register("firstName")} />
              {profileForm.formState.errors.firstName ? (
                <p className="field-error">{profileForm.formState.errors.firstName.message}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="profile-last" className="label">
                Last name
              </label>
              <input id="profile-last" className="input mt-2" {...profileForm.register("lastName")} />
              {profileForm.formState.errors.lastName ? (
                <p className="field-error">{profileForm.formState.errors.lastName.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-mobile" className="label">
                Mobile number
              </label>
              <input id="profile-mobile" className="input mt-2" inputMode="tel" {...profileForm.register("mobile")} />
              {profileForm.formState.errors.mobile ? (
                <p className="field-error">{profileForm.formState.errors.mobile.message}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="profile-email" className="label">
                Email address
              </label>
              <input id="profile-email" className="input mt-2 bg-cream-deep" value={customer.email} disabled readOnly />
              <p className="mt-1.5 text-xs text-muted">Contact the studio to change your email address.</p>
            </div>
          </div>

          <input type="hidden" {...profileForm.register("avatarUrl")} />
          <input type="hidden" {...profileForm.register("avatarPublicId")} />

          <button type="submit" className="btn-primary" disabled={profileForm.formState.isSubmitting}>
            {profileForm.formState.isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {profileForm.formState.isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      {/* -------------------------------------------------------- password */}
      <section className="card p-6">
        <h2 className="font-display text-xl">Password & security</h2>
        <p className="mt-1 text-sm text-muted">
          Choose a strong password you do not use anywhere else. You will stay signed in on this device.
        </p>

        <Divider className="my-5" />

        <form onSubmit={savePassword} noValidate className="space-y-5">
          {passwordDone ? <Alert tone="success">Your password has been updated.</Alert> : null}
          {passwordError ? <Alert tone="danger">{passwordError}</Alert> : null}

          <div>
            <label htmlFor="current-password" className="label">
              Current password
            </label>
            <div className="mt-2">
              <PasswordInput id="current-password" autoComplete="current-password" {...passwordForm.register("currentPassword")} />
            </div>
            {passwordForm.formState.errors.currentPassword ? (
              <p className="field-error">{passwordForm.formState.errors.currentPassword.message}</p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="profile-new-password" className="label">
                New password
              </label>
              <div className="mt-2">
                <PasswordInput id="profile-new-password" autoComplete="new-password" {...passwordForm.register("password")} />
              </div>
              <PasswordHints value={newPassword} />
              {passwordForm.formState.errors.password ? (
                <p className="field-error">{passwordForm.formState.errors.password.message}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="profile-confirm-password" className="label">
                Confirm new password
              </label>
              <div className="mt-2">
                <PasswordInput
                  id="profile-confirm-password"
                  autoComplete="new-password"
                  {...passwordForm.register("confirmPassword")}
                />
              </div>
              {passwordForm.formState.errors.confirmPassword ? (
                <p className="field-error">{passwordForm.formState.errors.confirmPassword.message}</p>
              ) : null}
            </div>
          </div>

          <button type="submit" className="btn-outline" disabled={passwordForm.formState.isSubmitting}>
            {passwordForm.formState.isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            {passwordForm.formState.isSubmitting ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </div>
  );
}
