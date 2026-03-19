import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const modeEnv = loadEnv(mode, process.cwd(), "VITE_");
  const githubPagesEnv = loadEnv("github-pages", process.cwd(), "VITE_");
  const supabaseUrl = modeEnv.VITE_SUPABASE_URL || githubPagesEnv.VITE_SUPABASE_URL || "";
  const supabasePublishableKey =
    modeEnv.VITE_SUPABASE_PUBLISHABLE_KEY || githubPagesEnv.VITE_SUPABASE_PUBLISHABLE_KEY || "";

  return {
    base: mode === "github-pages" ? "/runflowrun/" : "./",
    plugins: [react()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
    },
  };
});
