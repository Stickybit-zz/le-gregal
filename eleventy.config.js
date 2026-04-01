import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function (eleventyConfig) {

  // ── Passthrough copies ────────────────────────────────────────────────────
  eleventyConfig.addPassthroughCopy({ "static/css":    "css"    });
  eleventyConfig.addPassthroughCopy({ "static/js":     "js"     });
  eleventyConfig.addPassthroughCopy({ "static/photos": "photos" });
  eleventyConfig.addPassthroughCopy({ "static/videos": "videos" });
  eleventyConfig.addPassthroughCopy({ "src/_data/*.json": "data" });

  // ── Filters ───────────────────────────────────────────────────────────────

  // Format date lisible
  eleventyConfig.addFilter("dateDisplay", (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric"
    });
  });

  // Format date pour <time datetime="">
  eleventyConfig.addFilter("dateISO", (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toISOString();
  });

  // Année seule
  eleventyConfig.addFilter("year", (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).getFullYear();
  });

  // Mois + année
  eleventyConfig.addFilter("monthYear", (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      month: "long", year: "numeric"
    });
  });

  // Tronque un texte en supprimant les balises HTML
  eleventyConfig.addFilter("excerpt", (html, length = 200) => {
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.length > length ? text.slice(0, length) + "…" : text;
  });

  // Slug depuis un titre (pour ancres)
  eleventyConfig.addFilter("slugify", (str) => {
    return (str || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  });

  // Commentaires d'un post donné
  eleventyConfig.addFilter("commentsFor", (commentsMap, postId) => {
    return (commentsMap[postId] || []);
  });

  // ── Collections ───────────────────────────────────────────────────────────

  // Collection de posts depuis posts.json
  eleventyConfig.addCollection("posts", () => {
    return JSON.parse(
      readFileSync(join(__dirname, "src/_data/posts.json"), "utf-8")
    );
  });

  // Collection de catégories depuis categories.json
  eleventyConfig.addCollection("categories", () => {
    return JSON.parse(
      readFileSync(join(__dirname, "src/_data/categories.json"), "utf-8")
    );
  });

  // ── Options Eleventy ──────────────────────────────────────────────────────
  return {
    pathPrefix: "/le-gregal/",
    dir: {
      input:    "src",
      output:   "_site",
      includes: "_includes",
      data:     "_data",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["njk", "html", "md"],
  };
}
