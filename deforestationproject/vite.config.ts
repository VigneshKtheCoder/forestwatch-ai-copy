import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    server: {
      port: 5000,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  },
});
