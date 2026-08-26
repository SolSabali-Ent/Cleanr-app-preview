import { Outlet } from "react-router-dom";
import { CustomerBottomNav } from "./CustomerBottomNav";
import { ProviderContextProvider } from "../provider/ProviderContext";

export function CustomerAppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 flex justify-center">
      {/* Mobile shell */}
      <div className="w-full max-w-md bg-slate-950 text-white relative flex flex-col pb-24">
        {/* Safe area top */}
        <div className="h-4" />

        {/* Content area */}
        <ProviderContextProvider>
          <main className="flex-1 px-4 pb-4">
            <Outlet />
          </main>
        </ProviderContextProvider>

        {/* Bottom Nav */}
        <CustomerBottomNav />
      </div>
    </div>
  );
}

