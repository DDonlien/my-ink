import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'ink', test: /node_modules[\\/]inkjs[\\/]/ },
            { name: 'editor', test: /node_modules[\\/](?:@codemirror|@lezer|@uiw)[\\/]/ },
            { name: 'graph', test: /node_modules[\\/]@xyflow[\\/]/ },
          ],
        },
      },
    },
  },
  test: { include: ['tests/**/*.test.{ts,tsx}'], setupFiles: ['tests/setup.ts'] },
});
