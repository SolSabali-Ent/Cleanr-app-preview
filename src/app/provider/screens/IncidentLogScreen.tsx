import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { track } from "../../../lib/analytics";
import { useSafeBack } from "../../../hooks/useSafeBack";

const MAX_IMAGES = 5;

export default function IncidentLogScreen() {
  const { jobId } = useParams<{ jobId: string }>();
  const goBack = useSafeBack(
    jobId ? `/csp/dashboard/jobs/${jobId}` : "/csp/dashboard/jobs",
    jobId ? `/admin/full-app/csp/jobs/${jobId}` : "/admin/full-app/csp/jobs"
  );
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const newFiles = Array.from(e.target.files);
    setImages((prev) => [...prev, ...newFiles].slice(0, MAX_IMAGES));
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (providerId: string, incidentId: string): Promise<string[]> => {
    const uploadedPaths: string[] = [];
    for (const file of images) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filePath = `providers/${providerId}/incidents/${incidentId}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage
        .from("incident-photos")
        .upload(filePath, file, { upsert: false });
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
      const { error: incidentError } = await supabase.rpc("submit_provider_incident", {
        p_incident_id: incidentId,
        p_booking_id: jobId,
        p_description: description.trim(),
        p_image_paths: imagePaths,
      });
      if (incidentError) throw incidentError;
      track("incident_submitted", { incidentId });
      alert("Incident reported. Our team will review it shortly.");
      goBack();
    } catch (err) {
      console.error(err);
      alert("Failed to submit incident. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="text-white pb-24 relative min-h-[60vh]">
      <img
        src="/cleanr_final-04.png"
        alt=""
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ zIndex: 1, width: "360px", opacity: 0.08 }}
      />
      <div className="relative z-10">
        <button
          onClick={goBack}
          className="inline-flex items-center text-xs text-slate-400 mb-3"
        >
          ← Back
        </button>

        <h1 className="text-xl font-semibold mb-4">Report Incident</h1>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            placeholder="Describe what happened..."
            className="w-full h-40 p-3 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
          />

          <div className="mt-4">
            <label className="inline-block px-3.5 py-2.5 bg-[#0A84FF] text-white text-sm font-medium rounded-xl cursor-pointer shadow-md shadow-[#0A84FF]/40 active:scale-[0.99] transition">
              + Add Photos {images.length > 0 && `(${images.length}/${MAX_IMAGES})`}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleImageChange}
                className="hidden"
                disabled={images.length >= MAX_IMAGES}
              />
            </label>

            <div className="flex flex-wrap gap-2.5 mt-3">
              {previewUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt="Preview"
                    className="w-20 h-20 object-cover rounded-xl border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold shadow flex items-center justify-center hover:bg-red-600"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <button
          className="w-full bg-[#0A84FF] text-white py-3 rounded-xl text-sm font-semibold shadow-md shadow-[#0A84FF]/40 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit Incident"}
        </button>
      </div>
    </div>
  );
}
