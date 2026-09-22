import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// Same-origin proxy for the TypeSafe API: api.typesafe.ai rejects browser
// origins (CORS), so dev/preview traffic goes through here instead.
const typesafeProxy = {
  '/typesafe-api': {
    target: 'https://api.typesafe.ai',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/typesafe-api/, ''),
  },
}

export default defineConfig({
  // React Compiler (React 19) auto-memoizes components — no manual useMemo/useCallback/memo needed.
  plugins: [react({ compiler: true }), tailwindcss()],
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  server: { proxy: typesafeProxy },
  preview: { proxy: typesafeProxy },
})
