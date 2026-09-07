import { supabase } from "./supabase";

const PROFILE_PHOTO_BUCKET = "profile-photos";
const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROFILE_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionForType(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function getSignedProfilePhotoUrl(path: string | null | undefined): Promise<string | null> {
  const normalized = path?.trim();
  if (!normalized) return null;
  const { data, error } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).createSignedUrl(normalized, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export async function uploadMyProfilePhoto(file: File, userId: string): Promise<string> {
  if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) {
    throw new Error("Please choose a JPG, PNG, or WebP image.");
  }
  if (file.size <= 0 || file.size > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error("Profile photos must be 5 MB or smaller.");
  }

  const extension = extensionForType(file.type);
  const path = `${userId}/profile.${extension}`;
  const { error: uploadError } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (uploadError) throw uploadError;

  const { error: profileError } = await supabase.rpc("set_my_profile_photo_path", { p_path: path });
  if (profileError) throw profileError;
  return path;
}

export async function removeMyProfilePhoto(path: string | null | undefined): Promise<void> {
  const normalized = path?.trim();
  const { error: profileError } = await supabase.rpc("set_my_profile_photo_path", { p_path: null });
  if (profileError) throw profileError;
  if (normalized) {
    await supabase.storage.from(PROFILE_PHOTO_BUCKET).remove([normalized]);
  }
}

export type AssignedCustomerProfile = {
  customer_id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  full_name: string | null;
  profile_photo_path: string | null;
  preferred_communication: string | null;
  what_matters_most: string | null;
};

export async function getAssignedBookingCustomerProfile(bookingId: string): Promise<AssignedCustomerProfile | null> {
  const { data, error } = await supabase.rpc("get_booking_customer_profile", { p_booking_id: bookingId });
  if (error || !data) return null;
  return data as AssignedCustomerProfile;
}
