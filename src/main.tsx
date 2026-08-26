import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { AppRouter } from "./router/AppRouter";

// Dev: drop stale PWA service workers so `/` does not serve an old cached bundle.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => void registration.unregister());
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
);
