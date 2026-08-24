/// <reference types="vitest/config" />

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    glsl(),
    {
      name: 'startup-message',
      configureServer(server) {
        if (!server.httpServer) return;
        server.httpServer.once('listening', () => {
          // Use setTimeout to ensure the message prints after Vite's default output
          setTimeout(() => {
            console.log(
              '\n🎉 Server started at \x1b[32mhttps://test-dwman.localhost \x1b[0m🎉\n'
            );
          }, 100);
        });
      },
    },
  ],
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
