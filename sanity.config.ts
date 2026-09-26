import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./src/sanity/schema";

export default defineConfig({
  name: "museum-of-almost",
  title: "The Museum of Almost",
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || "notconfigured",
  dataset: process.env.SANITY_STUDIO_DATASET || "production",
  plugins: [structureTool()],
  schema: { types: schemaTypes },
});
