import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, MapPin, MoreHorizontal, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { customerRouteForContext } from "../../lib/contextualRoutes";
import {
  archiveMyServiceAddress,
  listMyVerifiedServiceAddresses,
  renameMyServiceAddress,
  setMyDefaultServiceAddress,
  type CustomerServiceAddress,
} from "../../lib/customerServiceAddressApi";

function formatLastUsed(value: string | null) {
  if (!value) return "Not used yet";
  try {
    return `Last used ${new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  } catch {
    return "Saved address";
  }
}

export function Addresses() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const route = (canonicalPath: string) => customerRouteForContext(pathname, canonicalPath);
  const [addresses, setAddresses] = useState<CustomerServiceAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAddresses(await listMyVerifiedServiceAddresses());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your service addresses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAddresses();
  }, [loadAddresses]);

  async function saveLabel(address: CustomerServiceAddress) {
    const label = editingLabel.trim();
    if (!label || label === address.label || busyId) {
      setEditingId(null);
      return;
    }
    setBusyId(address.id);
    try {
      await renameMyServiceAddress(address.id, label);
      setEditingId(null);
      await loadAddresses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename this address.");
    } finally {
      setBusyId(null);
    }
  }

  async function makeDefault(address: CustomerServiceAddress) {
    if (address.isDefault || busyId) return;
    setBusyId(address.id);
    try {
      await setMyDefaultServiceAddress(address.id);
      await loadAddresses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update your default address.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeAddress(address: CustomerServiceAddress) {
    if (busyId) return;
    const confirmed = window.confirm(`Remove ${address.label} from your saved places? This will not change past or already scheduled cleanings.`);
    if (!confirmed) return;
    setBusyId(address.id);
    try {
      await archiveMyServiceAddress(address.id);
      await loadAddresses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove this saved address.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="text-[#0B1220] pb-4">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="w-3 h-3" />}
        className="mb-4 !px-0 text-[#667085]"
        onClick={() => navigate(route("/app/profile"))}
      >
        Back
      </Button>

      <header className="mb-5">
        <h1 className="text-xl font-semibold">Your places</h1>
        <p className="mt-1 text-sm text-[#667085]">
          Save more than one home and choose the right place whenever you book.
        </p>
      </header>

      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#DCEED7] bg-[#F6FBF4] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#166534]" />
        <div>
          <p className="text-sm font-medium text-[#166534]">Private to your account</p>
          <p className="mt-1 text-xs leading-5 text-[#667085]">
            Use labels like My home, Mom&apos;s house, or Lake house. Cleanr keeps the saved place private and only shares what is needed for an active cleaning.
          </p>
        </div>
      </div>

      <Button variant="primaryGreen" size="lg" fullWidth onClick={() => navigate(route("/book"))}>
        Book at a new place
      </Button>
      <p className="mt-2 mb-5 text-center text-[11px] text-[#98A2B3]">
        A new place is saved after its first paid booking is verified.
      </p>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
          <p className="text-sm text-[#667085]">Loading your places...</p>
        </div>
      ) : addresses.length === 0 ? (
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#8DCC64]" />
            <div>
              <p className="text-sm font-semibold">No saved places yet</p>
              <p className="mt-1 text-sm text-[#667085]">Book your first cleaning and we&apos;ll save the verified service address for next time.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <div key={address.id} className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3FAF1] text-[#166534]">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {editingId === address.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={editingLabel}
                            maxLength={80}
                            onChange={(event) => setEditingLabel(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void saveLabel(address);
                              if (event.key === "Escape") setEditingId(null);
                            }}
                            className="min-w-0 flex-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-[#8DCC64]"
                          />
                          <button type="button" onClick={() => void saveLabel(address)} className="text-xs font-semibold text-[#166534]">Save</button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{address.label}</p>
                          {address.isDefault ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10px] font-semibold text-[#027A48]">
                              <CheckCircle2 className="h-3 w-3" /> Default
                            </span>
                          ) : null}
                        </div>
                      )}
                      <p className="mt-2 text-sm font-medium">{address.street}{address.unit ? `, Unit ${address.unit}` : ""}</p>
                      <p className="mt-0.5 text-sm text-[#667085]">{address.city}, {address.state} {address.zip}</p>
                      <p className="mt-2 text-[11px] text-[#98A2B3]">{formatLastUsed(address.lastUsedAt)}</p>
                    </div>
                    <MoreHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-[#98A2B3]" />
                  </div>

                  {editingId !== address.id ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === address.id}
                        onClick={() => {
                          setEditingId(address.id);
                          setEditingLabel(address.label);
                        }}
                        className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#475467] disabled:opacity-50"
                      >
                        Rename
                      </button>
                      {!address.isDefault ? (
                        <button
                          type="button"
                          disabled={busyId === address.id}
                          onClick={() => void makeDefault(address)}
                          className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-semibold text-[#475467] disabled:opacity-50"
                        >
                          Make default
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === address.id}
                        onClick={() => void removeAddress(address)}
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-[#B42318] disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
