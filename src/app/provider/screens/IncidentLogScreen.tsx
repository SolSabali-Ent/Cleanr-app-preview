import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { track } from "../../../lib/analytics";
import { useSafeBack } from "../../../hooks/useSafeBack";

const MAX_IMAGES = 5;

type IncidentType = "injury" | "property_damage" | "missing_item" | "safety" | "vehicle" | "other";

const INCIDENT_TYPES: Array<{ value: IncidentType; label: string }> = [
  { value: "property_damage", label: "Property damage" },
  { value: "injury", label: "Injury" },
  { value: "missing_item", label: "Missing item concern" },
  { value: "safety", label: "Safety concern" },
  { value: "vehicle", label: "Vehicle / travel incident" },
  { value: "other", label: "Other" },
];

export default function IncidentLogScreen() {
  const { jobId } = useParams<{ jobId: string }>();
  const goBack = useSafeBack(
    jobId ? `/csp/dashboard/jobs/${jobId}` : "/csp/dashboard/jobs",
    jobId ? `/admin/full-app/csp/jobs/${jobId}` : "/admin/full-app/csp/jobs"
  );
  const [incidentType, setIncidentType] = useState<IncidentType>("property_damage");
  const [occurredAt, setOccurredAt] = useState("");
  const [immediateDanger, setImmediateDanger] = useState(false);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    const newFiles = Array.from(event.target.files);
    setImages((previous) => [...previous, ...newFiles].slice(0, MAX_IMAGES));
    event.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const uploadImages = async (providerId: string, incidentId: string): Promise<string[]> => {
    const uploadedPaths: string[] = [];
    for (const file of images) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `providers/${providerId}/incidents/${incidentId}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("incident-photos").upload(filePath, file, { upsert: false });
      if (error) throw error;
      uploadedPaths.push(filePath);
    }
    return uploadedPaths;
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      alert("Please describe what happened.");
      return;
    }
    if (images.length === 0) {
      alert("Please add at least one photo.");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("You must be signed in to report an incident.");
      return;
    }
    if (!jobId) {
      alert("Missing job context.");
      return;
    }

    setIsSubmitting(true);
    try {
      const incidentId = crypto.randomUUID();
      const imagePaths = await uploadImages(user.id, incidentId);
      const occurredAtIso = occurredAt ? new Date(occurredAt).toISOString() : null;
      const { error: incidentError } = await supabase.rpc("submit_provider_incident_v2", {
        p_incident_id: incidentId,
        p_booking_id: jobId,
        p_description: description.trim(),
        p_image_paths: imagePaths,
        p_incident_type: incidentType,
        p_occurred_at: occurredAtIso,
        p_immediate_danger: immediateDanger,
      });
      if (incidentError) throw incidentError;
      track("incident_submitted", { incidentId, incidentType, immediateDanger });
      alert("Incident reported. Cleanr will preserve the report and review it.");
      goBack();
    } catch (error) {
      console.error(error);
      alert("Failed to submit incident. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[60vh] pb-24 text-white">
      <div className="relative z-10">
        <button onClick={goBack} className="mb-4 inline-flex items-center text-sm text-slate-400">← Back</button>
        <h1 className="text-2xl font-semibold">Report an incident</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Record what happened during or around this visit. Your submitted report and photos are preserved for review.</p>

        <section className="mt-6 space-y-5 border-y border-white/10 py-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">What happened?</span>
            <select
              value={incidentType}
              onChange={(event) => setIncidentType(event.target.value as IncidentType)}
              className="h-12 w-full rounded-xl border border-white/10 bg-[#141B2E] px-3 text-base text-white outline-none focus:border-[#0000FE]"
            >
              {INCIDENT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">When did it happen? <span className="font-normal text-slate-500">Optional</span></span>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className="h-12 w-full rounded-xl border border-white/10 bg-[#141B2E] px-3 text-base text-white outline-none focus:border-[#0000FE]"
            />
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#11182B] p-4">
            <input type="checkbox" checked={immediateDanger} onChange={(event) => setImmediateDanger(event.target.checked)} className="mt-1 h-4 w-4" />
            <span>
              <span className="block text-sm font-semibold text-white">There is an immediate safety concern</span>
              <span className="mt-1 block text-xs leading-5 text-slate-400">Use this only when someone or the property may still be at risk. If emergency help is needed, contact emergency services first.</span>
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Describe what happened</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
              placeholder="Stick to what you observed, what was affected, and what happened next."
              className="h-40 w-full resize-none rounded-xl border border-white/10 bg-[#141B2E] p-3 text-base text-white placeholder-slate-500 outline-none focus:border-[#0000FE]"
            />
          </label>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-300">Photos</p>
                <p className="mt-1 text-xs text-slate-500">Add 1–5 photos that help document what you observed.</p>
              </div>
              <label className="cursor-pointer rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white">
                Add photos {images.length ? `${images.length}/${MAX_IMAGES}` : ""}
                <input type="file" accept="image/*" capture="environment" multiple onChange={handleImageChange} className="hidden" disabled={images.length >= MAX_IMAGES} />
              </label>
            </div>

            {previewUrls.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2.5">
                {previewUrls.map((url, index) => (
                  <div key={url} className="relative">
                    <img src={url} alt={`Incident evidence ${index + 1}`} className="h-20 w-20 rounded-xl border border-white/10 object-cover" />
                    <button type="button" onClick={() => removeImage(index)} className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white" aria-label={`Remove photo ${index + 1}`}>×</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <p className="mt-4 text-xs leading-5 text-slate-500">Submitting records your report. It does not determine fault, insurance coverage, or responsibility for a claim.</p>

        <button
          className="mt-5 w-full rounded-xl bg-[#0000FE] py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting…" : "Submit incident report"}
        </button>
      </div>
    </div>
  );
}
