const SAFE_FOLDER_SEGMENT = /^[a-zA-Z0-9_-]+$/;
const SAFE_CLOUDINARY_KEY = /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/;
const SAFE_LOCAL_FILENAME = /^[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/i;

function avatarFolder(userId: string) {
  return SAFE_FOLDER_SEGMENT.test(userId) ? `avatars/${userId}` : null;
}

/** True only for an avatar asset placed in this account's private upload folder. */
export function isManagedAvatarPublicId(publicId: string, userId: string) {
  const folder = avatarFolder(userId);
  if (!folder) return false;
  const prefix = `${folder}/`;
  if (publicId.startsWith(`local:${prefix}`)) return SAFE_LOCAL_FILENAME.test(publicId.slice(`local:${prefix}`.length));
  return publicId.startsWith(prefix) && SAFE_CLOUDINARY_KEY.test(publicId.slice(prefix.length));
}

/** Rejects cross-folder URLs and public IDs submitted for another account's media. */
export function isValidAvatarMediaReference(url: string, publicId: string, userId: string) {
  if (!isManagedAvatarPublicId(publicId, userId)) return false;

  const folder = avatarFolder(userId);
  if (!folder) return false;

  if (publicId.startsWith("local:")) {
    const relativePath = publicId.slice("local:".length);
    return url === `/uploads/${relativePath}`;
  }

  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "res.cloudinary.com" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      parsed.pathname.includes("/image/upload/") &&
      parsed.pathname.includes(`/${folder}/`)
    );
  } catch {
    return false;
  }
}
