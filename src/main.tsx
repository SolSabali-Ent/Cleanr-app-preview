import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { AppRouter } from "./router/AppRouter";

const publicHostMode = import.meta.env.VITE_PUBLIC_HOST_MODE === "1";

if ("serviceWorker" in navigator && (import.meta.env.DEV || publicHostMode)) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => void registration.unregister());
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
