#!/usr/bin/env python3
"""
Génère une page Nunjucks par article dans src/posts/<slug>/index.njk
et les pages d'étapes dans src/etapes/<slug>/index.njk
"""

import json
import os
import re
from pathlib import Path
from unicodedata import normalize

BASE = Path(__file__).parent.parent
DATA_DIR  = BASE / "src" / "_data"
POSTS_DIR = BASE / "src" / "posts"

# ── Helpers ────────────────────────────────────────────────────────────────────

def slugify(s: str) -> str:
    s = normalize("NFD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower())
    return s.strip("-")

def escape_yaml(s: str) -> str:
    """Échappe une valeur pour le frontmatter YAML (entre guillemets doubles)."""
    return s.replace("\\", "\\\\").replace('"', '\\"')

# ── Génération des pages posts ─────────────────────────────────────────────────

def generate_posts():
    with open(DATA_DIR / "posts.json", encoding="utf-8") as f:
        posts = json.load(f)
    with open(DATA_DIR / "comments.json", encoding="utf-8") as f:
        all_comments = json.load(f)

    POSTS_DIR.mkdir(parents=True, exist_ok=True)

    for i, post in enumerate(posts):
        slug = post["slug"]
        post_id = post["id"]

        # Dossier de sortie : src/posts/<slug>/index.njk
        # mais le slug peut être "2009/07/transat-..."
        out_path = BASE / "src" / slug / "index.njk"
        out_path.parent.mkdir(parents=True, exist_ok=True)

        prev_post = posts[i - 1] if i > 0 else None
        next_post = posts[i + 1] if i < len(posts) - 1 else None
        comments  = all_comments.get(post_id, [])

        # GPS inline pour le frontmatter
        gps_yaml = "null"
        if post["gps"]:
            g = post["gps"]
            gps_yaml = f'{{lat: {g["lat"]}, lon: {g["lon"]}}}'

        # Catégories pour le frontmatter
        cats_yaml = json.dumps(post["categories"], ensure_ascii=False)

        prev_yaml = "null"
        if prev_post:
            prev_yaml = (
                f'{{slug: "{escape_yaml(prev_post["slug"])}", '
                f'title: "{escape_yaml(prev_post["title"])}"}}'
            )
        next_yaml = "null"
        if next_post:
            next_yaml = (
                f'{{slug: "{escape_yaml(next_post["slug"])}", '
                f'title: "{escape_yaml(next_post["title"])}"}}'
            )

        # Commentaires en JSON inline dans le frontmatter
        comments_json = json.dumps(comments, ensure_ascii=False)

        content = f"""---
layout: post-layout.njk
title: "{escape_yaml(post['title'])}"
description: "{escape_yaml(post['title'])} — Le Grégal"
postData:
  id: "{post['id']}"
  slug: "{escape_yaml(slug)}"
  title: "{escape_yaml(post['title'])}"
  author: "{escape_yaml(post['author'])}"
  published: "{post['published']}"
  updated: "{post['updated']}"
  categories: {cats_yaml}
  gps: {gps_yaml}
  comment_count: {post['comment_count']}
  content: |
{chr(10).join("    " + line for line in post['content'].splitlines())}
prevPost: {prev_yaml}
nextPost: {next_yaml}
comments: {comments_json}
---
"""
        out_path.write_text(content, encoding="utf-8")

    print(f"✓ {len(posts)} pages posts générées")

# ── Génération des pages étapes ────────────────────────────────────────────────

def generate_etapes():
    with open(DATA_DIR / "posts.json", encoding="utf-8") as f:
        posts = json.load(f)
    with open(DATA_DIR / "site.json", encoding="utf-8") as f:
        site = json.load(f)

    # Grouper posts par catégorie
    cat_posts = {}
    for post in posts:
        for cat in post["categories"]:
            cat_posts.setdefault(cat, []).append(post)

    etapes_dir = BASE / "src" / "etapes"
    etapes_dir.mkdir(parents=True, exist_ok=True)

    etapes_list = []
    for cat, cat_post_list in cat_posts.items():
        cat_slug = slugify(cat)
        cat_dir  = etapes_dir / cat_slug
        cat_dir.mkdir(parents=True, exist_ok=True)

        # Tri chronologique
        cat_post_list.sort(key=lambda p: p["published"])

        # Récupère les coords GPS de cette étape
        gps_points = [p["gps"] for p in cat_post_list if p["gps"]]
        if gps_points:
            center_lat = sum(g["lat"] for g in gps_points) / len(gps_points)
            center_lon = sum(g["lon"] for g in gps_points) / len(gps_points)
            gps_center = f"[{round(center_lat, 4)}, {round(center_lon, 4)}]"
        else:
            gps_center = "null"

        # Posts résumés (sans contenu HTML pour alléger)
        posts_summary = [
            {
                "slug":      p["slug"],
                "title":     p["title"],
                "published": p["published"],
                "author":    p["author"],
                "gps":       p["gps"],
                "excerpt":   re.sub(r"<[^>]+>", " ", p["content"])[:200].strip() + "…",
            }
            for p in cat_post_list
        ]

        posts_json = json.dumps(posts_summary, ensure_ascii=False)

        page_content = f"""---
layout: etape-layout.njk
title: "{escape_yaml(cat)}"
etapeSlug: "{cat_slug}"
categoryName: "{escape_yaml(cat)}"
gpsCenter: {gps_center}
postCount: {len(cat_post_list)}
etapePosts: {posts_json}
---
"""
        (cat_dir / "index.njk").write_text(page_content, encoding="utf-8")
        etapes_list.append({
            "slug":       cat_slug,
            "name":       cat,
            "post_count": len(cat_post_list),
            "gps_center": gps_center,
            "first_post": cat_post_list[0]["published"][:10],
        })

    # Page index des étapes
    etapes_json = json.dumps(etapes_list, ensure_ascii=False)
    index_content = f"""---
layout: base.njk
title: Étapes du voyage
leaflet: true
etapesList: {etapes_json}
---
{{% include "etapes-index.njk" %}}
"""
    (etapes_dir / "index.njk").write_text(index_content, encoding="utf-8")
    print(f"✓ {len(etapes_list)} pages d'étapes générées")


if __name__ == "__main__":
    generate_posts()
    generate_etapes()
    print("✓ Génération terminée")
