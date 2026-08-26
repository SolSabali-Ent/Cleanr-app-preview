const statuses = ['en_route', 'arrived', 'in_progress', 'completed'];

interface JobStatusStepperProps {
  currentStatus: string;
}

export default function JobStatusStepper({ currentStatus }: JobStatusStepperProps) {
  const currentIndex = statuses.indexOf(currentStatus);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-md">
      <div className="flex items-center relative">
        {statuses.map((status, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = status === currentStatus;
          
          return (
            <div key={status} className="flex flex-col items-center flex-1 relative">
              {/* Connecting line */}
              {index < statuses.length - 1 && (
                <div
                  className={`absolute top-2 left-1/2 h-0.5 w-full ${
                    isActive && index < currentIndex ? 'bg-[#0A84FF]' : 'bg-slate-200'
                  }`}
                  style={{ zIndex: 0 }}
                />
              )}
              {/* Status dot */}
              <div
                className={`relative z-10 w-4 h-4 rounded-full ${
                  isCurrent
                    ? 'bg-[#0A84FF] ring-2 ring-[#0A84FF] ring-offset-2'
                    : isActive
                    ? 'bg-[#0A84FF]'
                    : 'bg-slate-200'
                }`}
              />
              {/* Status label */}
              <span className="text-xs mt-2 capitalize text-slate-900 font-medium text-center">
                {status.replace('_', ' ')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

