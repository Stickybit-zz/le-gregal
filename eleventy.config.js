import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function (eleventyConfig) {

  // ── Passthrough copies ────────────────────────────────────────────────────
  eleventyConfig.addPassthroughCopy({ "static/CNAME":     "CNAME"     });
  eleventyConfig.addPassthroughCopy({ "static/robots.txt": "robots.txt" });
  eleventyConfig.addPassthroughCopy({ "static/css":    "css"    });
  eleventyConfig.addPassthroughCopy({ "static/js":     "js"     });
  eleventyConfig.addPassthroughCopy({ "static/photos": "photos" });
  eleventyConfig.addPassthroughCopy({ "static/thumbs": "thumbs" });
  eleventyConfig.addPassthroughCopy({ "static/videos": "videos" });
  eleventyConfig.addPassthroughCopy({ "src/_data/*.json": "data" });
  eleventyConfig.addPassthroughCopy({ "static/data":      "data" });

  // ── Filters ───────────────────────────────────────────────────────────────

  // Lookup category by slug
  eleventyConfig.addFilter("catBySlug", (categories, slug) =>
    (categories || []).find(c => c.slug === slug) || {}
  );

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

  // RFC 2822 pour RSS
  eleventyConfig.addFilter("dateRFC", (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toUTCString();
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

  // Date courte YYYY-MM-DD (pour sitemap lastmod)
  eleventyConfig.addFilter("dateShort", (dateStr) => {
    if (!dateStr) return "";
    return String(dateStr).slice(0, 10);
  });

  eleventyConfig.addFilter("limit", (arr, n) => arr.slice(0, n));

  // Sérialise une valeur en JSON (pour JSON-LD)
  eleventyConfig.addFilter("tojson", (val) => JSON.stringify(val ?? ""));

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


  // ── Options Eleventy ──────────────────────────────────────────────────────
  return {
    pathPrefix: "/",
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
