import { supabase } from "@/lib/supabase";

export type CustomerServiceAddress = {
  id: string;
  label: string;
  street: string;
  unit: string | null;
  city: string;
  state: string;
  zip: string;
  formattedAddress: string;
  isDefault: boolean;
  lastUsedAt: string | null;
  createdAt: string;
};

export type BookingServiceAddress = CustomerServiceAddress & {
  lat: number;
  lng: number;
};

type AddressRow = {
  id: string;
  label: string;
  street: string;
  unit: string | null;
  city: string;
  state: string;
  zip_code: string;
  formatted_address: string;
  is_default: boolean;
  last_used_at: string | null;
  created_at?: string;
  lat?: number;
  lng?: number;
};

function mapAddress(row: AddressRow): CustomerServiceAddress {
  return {
    id: row.id,
    label: row.label,
    street: row.street,
    unit: row.unit,
    city: row.city,
    state: row.state,
    zip: row.zip_code,
    formattedAddress: row.formatted_address,
    isDefault: row.is_default,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at ?? row.last_used_at ?? new Date(0).toISOString(),
  };
}

export async function listMyVerifiedServiceAddresses(): Promise<CustomerServiceAddress[]> {
  const { data, error } = await supabase.rpc("list_my_service_addresses");
  if (error) throw error;
  return ((data ?? []) as AddressRow[]).map(mapAddress);
}

export async function listMyServiceAddressesForBooking(zip?: string | null): Promise<BookingServiceAddress[]> {
  const { data, error } = await supabase.rpc("list_my_service_addresses_for_booking", {
    p_zip: zip?.trim() || null,
  });
  if (error) throw error;

  return ((data ?? []) as AddressRow[])
    .filter((row) => typeof row.lat === "number" && typeof row.lng === "number")
    .map((row) => ({
      ...mapAddress(row),
      lat: row.lat as number,
      lng: row.lng as number,
    }));
}

export async function renameMyServiceAddress(addressId: string, label: string): Promise<void> {
  const { error } = await supabase.rpc("rename_my_service_address", {
    p_address_id: addressId,
    p_label: label.trim(),
  });
  if (error) throw error;
}

export async function setMyDefaultServiceAddress(addressId: string): Promise<void> {
  const { error } = await supabase.rpc("set_my_default_service_address", {
    p_address_id: addressId,
  });
  if (error) throw error;
}

export async function archiveMyServiceAddress(addressId: string): Promise<void> {
  const { error } = await supabase.rpc("archive_my_service_address", {
    p_address_id: addressId,
  });
  if (error) throw error;
}
