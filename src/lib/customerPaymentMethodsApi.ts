import { supabase } from "@/lib/supabase";

export type CustomerPaymentMethod = {
  id: string;
  label: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  cardholderName: string | null;
  isDefault: boolean;
};

type RawMethod = {
  id?: string;
  label?: string;
  brand?: string;
  last4?: string;
  exp_month?: number | null;
  exp_year?: number | null;
  cardholder_name?: string | null;
  is_default?: boolean;
};

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("customer-payment-methods", { body });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export async function listMyPaymentMethods(): Promise<CustomerPaymentMethod[]> {
  const data = await invoke<{ payment_methods?: RawMethod[] }>({ action: "list" });
  return (data.payment_methods ?? []).flatMap((method) => {
    if (!method.id) return [];
    return [{
      id: method.id,
      label: method.label?.trim() || "Saved card",
      brand: method.brand?.trim() || "card",
      last4: method.last4?.trim() || "",
      expMonth: typeof method.exp_month === "number" ? method.exp_month : null,
      expYear: typeof method.exp_year === "number" ? method.exp_year : null,
      cardholderName: method.cardholder_name?.trim() || null,
      isDefault: method.is_default === true,
    }];
  });
}

export async function createPaymentMethodSetupUrl(returnUrl: string): Promise<string> {
  const data = await invoke<{ url?: string }>({ action: "create_setup", return_url: returnUrl });
  if (!data.url) throw new Error("Unable to open secure card setup.");
  return data.url;
}

export async function renamePaymentMethod(paymentMethodId: string, label: string): Promise<void> {
  await invoke({ action: "rename", payment_method_id: paymentMethodId, label });
}

export async function setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
  await invoke({ action: "set_default", payment_method_id: paymentMethodId });
}

export async function removePaymentMethod(paymentMethodId: string): Promise<void> {
  await invoke({ action: "remove", payment_method_id: paymentMethodId });
}
