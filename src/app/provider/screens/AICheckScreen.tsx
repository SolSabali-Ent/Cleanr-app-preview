import { useState } from 'react';
import { useSafeBack } from '../../../hooks/useSafeBack';

export default function AICheckScreen() {
  const goBack = useSafeBack('/csp/dashboard/jobs', '/admin/full-app/csp/jobs');
  const [image, setImage] = useState<File | null>(null);
  const [result, setResult] = useState<'pass' | 'flagged' | null>(null);

  const handleUpload = async () => {
    // Simulate call to GPT or AI scoring system (image would be sent in real impl)
    if (!image) return;
    setResult('pass'); // Or 'flagged'
  };

  return (
    <div className="text-white pb-24 relative min-h-[60vh]">
      <img 
        src="/cleanr_final-04.png" 
        alt="" 
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ zIndex: 1, width: '360px', opacity: 0.08 }}
      />
      <div className="relative z-10">
        <button
          onClick={goBack}
          className="inline-flex items-center text-xs text-slate-400 mb-3"
        >
          ← Back
        </button>

        <h1 className="text-xl font-semibold mb-4">AI Job Verification</h1>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
          <p className="text-xs font-semibold text-slate-500 mb-2">Upload Photos</p>
          <input 
            type="file" 
            onChange={(e) => setImage(e.target.files?.[0] || null)}
            className="w-full text-xs"
            multiple
          />
        </section>

        <button
          className="w-full bg-[#0A84FF] text-white py-3 rounded-xl text-sm font-semibold shadow-md shadow-[#0A84FF]/40 mb-3"
          onClick={handleUpload}
        >
          Run AI Check
        </button>

        {result && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-md">
            <p className={`text-lg font-bold text-center ${
              result === 'pass' ? 'text-green-600' : 'text-red-600'
            }`}>
              {result === 'pass' ? 'Job passed verification ✅' : 'Issue flagged 🚩'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
