import { useState } from 'react';

interface Props {
  onClose: () => void;
}

export default function IncidentReportModal({ onClose }: Props) {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!reason.trim()) {
      alert('Please describe the issue.');
      return;
    }
    alert(`🚨 Incident reported: ${reason}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-96 max-w-[90vw]">
        <h2 className="text-lg font-semibold mb-4 text-white">Report an Issue</h2>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 text-white p-2 h-24 rounded-xl placeholder-slate-400"
          placeholder="Describe what went wrong"
        />
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-700 rounded-xl text-slate-300 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

