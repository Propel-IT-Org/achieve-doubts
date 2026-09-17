import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tailwindcss(), reactRouter()],
	resolve: {
		tsconfigPaths: true,
	},
	optimizeDeps: {
		// Locates its .wasm file relative to its own module URL, which Vite's
		// dependency pre-bundling would break in development.
		exclude: ["@jsquash/webp"],
	},
});
