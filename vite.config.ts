import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  const publicHostMode = process.env.VITE_PUBLIC_HOST_MODE === "1";

  return {
    base: "/",
    plugins: [
      react(),
      ...(
        publicHostMode
          ? []
          : [
              VitePWA({
                registerType: "autoUpdate",
                manifest: {
                  name: "Cleanr",
                  short_name: "Cleanr",
                  theme_color: "#0A84FF",
                  icons: [
                    {
                      src: "/cleanr-app@2x.png",
                      sizes: "192x192",
                      type: "image/png",
                      purpose: "any",
                    },
                    {
                      src: "/cleanr-app@2x.png",
                      sizes: "512x512",
                      type: "image/png",
                      purpose: "any",
                    },
                  ],
                },
                workbox: {
                  globPatterns: ["**/*.{js,css,html,ico,png}"],
                  runtimeCaching: [],
                  maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
                },
                buildBase: "/",
              }),
            ]
      ),
    ],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
  };
});
