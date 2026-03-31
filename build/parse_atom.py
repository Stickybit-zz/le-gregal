#!/usr/bin/env python3
"""
Parser du feed.atom Blogger du Grégal.
Produit :
  - src/_data/posts.json       : 297 articles avec métadonnées + contenu HTML
  - src/_data/comments.json    : 1308 commentaires indexés par post_id
  - src/_data/track.json       : waypoints GPS ordonnés chronologiquement
  - src/_data/site.json        : métadonnées globales
"""

import xml.etree.ElementTree as ET
import json
import re
import os
import sys
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

# ── Chemins ──────────────────────────────────────────────────────────────────
ATOM_FILE = Path("/Users/fds/Downloads/Takeout/Blogger/Blogs/"
                 "Tour de l_atlantique - Transat en voilier - Le Gré/feed.atom")
OUT_DIR   = Path(__file__).parent.parent / "src" / "_data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Namespaces ────────────────────────────────────────────────────────────────
NS = {
    "atom":    "http://www.w3.org/2005/Atom",
    "blogger": "http://schemas.google.com/blogger/2018",
}

# ── GPS helpers ───────────────────────────────────────────────────────────────
def parse_gmap_spans(html: str):
    """
    Extrait les coords depuis le bloc Blogger gmap :
      <div name="gmap">
        <span name="36,38,2500 N">
          <span name="014,37,1600 W">
    Format span : "DDD,MM,SSSS H" où SSSS = décimales de minutes × 100
    → convertit en degrés décimaux.
    """
    m = re.search(
        r'<div[^>]*name=["\']gmap["\'][^>]*>.*?'
        r'<span[^>]*name=["\']([0-9,]+\s*[NSns])["\'][^>]*>.*?'
        r'<span[^>]*name=["\']([0-9,]+\s*[EWew])["\'][^>]*>',
        html, re.DOTALL | re.IGNORECASE
    )
    if not m:
        return None

    def span_to_dd(s: str) -> float:
        """'36,38,2500 N' → 36.6375 (degrés décimaux)"""
        s = s.strip()
        hemi = s[-1].upper()
        parts = s[:-1].strip().split(",")
        deg = float(parts[0])
        minutes = float(parts[1]) if len(parts) > 1 else 0.0
        # partie décimale des minutes encodée × 100
        dec = float(parts[2]) / 100 if len(parts) > 2 else 0.0
        dd = deg + (minutes + dec / 100) / 60
        if hemi in ("S", "W"):
            dd = -dd
        return round(dd, 6)

    try:
        lat = span_to_dd(m.group(1))
        lon = span_to_dd(m.group(2))
        return {"lat": lat, "lon": lon}
    except (ValueError, IndexError):
        return None


def parse_text_position(html: str):
    """
    Extrait coords depuis texte 'Position à HH:MM (UT±N) : 36°38,25 N - 014°37,16 W'
    """
    m = re.search(
        r'Position\s+(?:\w+\s+)?(?:[\d:hH]+)?\s*(?:\(UT[^)]*\))?\s*:?\s*'
        r'([\d]+)[°º]([\d]+[,.][\d]*)\s*([NS])\s*[-–]\s*'
        r'([\d]+)[°º]([\d]+[,.][\d]*)\s*([EW])',
        html, re.IGNORECASE
    )
    if not m:
        return None
    try:
        def to_dd(deg, minu, hemi):
            dd = float(deg) + float(minu.replace(",", ".")) / 60
            return round(-dd if hemi.upper() in ("S", "W") else dd, 6)
        lat = to_dd(m.group(1), m.group(2), m.group(3))
        lon = to_dd(m.group(4), m.group(5), m.group(6))
        return {"lat": lat, "lon": lon}
    except ValueError:
        return None


# ── Slug helpers ──────────────────────────────────────────────────────────────
def make_slug(filename_tag: str, title: str, pub_date: str) -> str:
    """Génère un slug propre depuis le tag filename Blogger ou le titre."""
    if filename_tag:
        # ex: /2009/07/transat-retour-acores-gibraltar-j4.html
        slug = filename_tag.strip("/").replace(".html", "")
        slug = re.sub(r"[^a-z0-9/_-]", "", slug)
        return slug
    # fallback : date + titre
    date_part = pub_date[:10] if pub_date else "0000-00-00"
    title_slug = re.sub(r"[^a-z0-9]+", "-",
                        title.lower().encode("ascii", "ignore").decode())
    title_slug = title_slug.strip("-")[:60]
    return f"{date_part[:4]}/{date_part[5:7]}/{title_slug}"


# ── Réécriture des images ─────────────────────────────────────────────────────
def rewrite_images(html: str) -> str:
    """
    Remplace les URLs blogger.googleusercontent.com par des chemins locaux
    si le fichier existe dans static/photos/, sinon garde l'URL externe.
    """
    photos_dir = Path(__file__).parent.parent / "static" / "photos"

    def replace_url(m):
        url = m.group(0)
        # Extrait le nom de fichier depuis l'URL
        fname = re.search(r"/([^/]+\.(jpg|jpeg|png|gif|JPG|JPEG|PNG))", url, re.IGNORECASE)
        if fname:
            local = photos_dir / fname.group(1)
            if local.exists():
                return f"/photos/{fname.group(1)}"
        return url

    return re.sub(
        r'https://blogger\.googleusercontent\.com/img/[^\s"\'<>]+',
        replace_url,
        html
    )


def clean_html(html: str) -> str:
    """Nettoie le HTML Blogger : supprime les blocs gmap, onblur, BLOGGER_PHOTO_ID."""
    # Supprime les blocs gmap (remplacés par la carte Leaflet)
    html = re.sub(r'<div[^>]*name=["\']gmap["\'][^>]*>.*?</div>', '', html,
                  flags=re.DOTALL | re.IGNORECASE)
    # Supprime onblur="try {parent.deselectBloggerImageGracefully()...}"
    html = re.sub(r'\s*onblur="[^"]*"', '', html)
    # Supprime les id="BLOGGER_PHOTO_ID_..."
    html = re.sub(r'\s*id="BLOGGER_PHOTO_ID_[^"]*"', '', html)
    # Remplace les images
    html = rewrite_images(html)
    return html.strip()


# ── Parsing principal ─────────────────────────────────────────────────────────
def parse_feed():
    print(f"Parsing {ATOM_FILE} …")
    tree = ET.parse(ATOM_FILE)
    root = tree.getroot()

    posts    = []
    comments = {}  # post_id → [comment, …]

    for entry in root.findall("atom:entry", NS):
        etype  = entry.findtext("blogger:type",   namespaces=NS, default="")
        status = entry.findtext("blogger:status", namespaces=NS, default="")

        raw_id = entry.findtext("atom:id", namespaces=NS, default="")
        # ex: tag:blogger.com,1999:blog-XXX.post-YYY
        post_id_m = re.search(r"\.post-(\d+)$", raw_id)
        post_id = post_id_m.group(1) if post_id_m else raw_id

        published = entry.findtext("atom:published", namespaces=NS, default="")
        updated   = entry.findtext("atom:updated",   namespaces=NS, default="")
        created   = entry.findtext("blogger:created", namespaces=NS, default="")
        title     = entry.findtext("atom:title",     namespaces=NS, default="")
        content_el = entry.find("atom:content",      namespaces=NS)
        content   = content_el.text if content_el is not None and content_el.text else ""
        author_el = entry.find("atom:author",        namespaces=NS)
        author    = author_el.findtext("atom:name",  namespaces=NS, default="") if author_el else ""
        filename  = entry.findtext("blogger:filename", namespaces=NS, default="")

        # Labels
        categories = [
            cat.get("term", "")
            for cat in entry.findall("atom:category", NS)
            if cat.get("term")
        ]

        # ── COMMENTAIRES ──────────────────────────────────────────────────
        if etype == "COMMENT":
            parent_el = entry.find("blogger:parent", NS)
            parent_raw = parent_el.text if parent_el is not None else ""
            parent_m = re.search(r"\.post-(\d+)$", parent_raw or "")
            parent_id = parent_m.group(1) if parent_m else ""

            comment = {
                "id":         post_id,
                "parent_id":  parent_id,
                "author":     author,
                "published":  published,
                "content":    unescape(content),
            }
            comments.setdefault(parent_id, []).append(comment)
            continue

        # ── ARTICLES ──────────────────────────────────────────────────────
        if etype != "POST":
            continue

        raw_html = unescape(content)

        # GPS
        gps = parse_gmap_spans(raw_html) or parse_text_position(raw_html)

        slug = make_slug(filename, title, published)

        post = {
            "id":           post_id,
            "slug":         slug,
            "title":        title,
            "author":       author,
            "published":    published,
            "updated":      updated,
            "categories":   categories,
            "gps":          gps,
            "content":      clean_html(raw_html),
            "comment_count": 0,  # rempli après
        }
        posts.append(post)

    # Tri chronologique
    posts.sort(key=lambda p: p["published"])

    # Compte des commentaires par post + injection
    for post in posts:
        pid = post["id"]
        c_list = comments.get(pid, [])
        # Tri commentaires par date
        c_list.sort(key=lambda c: c["published"])
        post["comment_count"] = len(c_list)

    # Déduplication de slugs (au cas où)
    seen_slugs = {}
    for post in posts:
        slug = post["slug"]
        if slug in seen_slugs:
            seen_slugs[slug] += 1
            post["slug"] = f"{slug}-{seen_slugs[slug]}"
        else:
            seen_slugs[slug] = 0

    # ── Track GPS (waypoints pour la carte globale) ────────────────────────
    track = []
    for post in posts:
        if post["gps"]:
            track.append({
                "lat":       post["gps"]["lat"],
                "lon":       post["gps"]["lon"],
                "title":     post["title"],
                "slug":      post["slug"],
                "published": post["published"],
            })

    # ── Étapes/régions (regroupement des catégories) ───────────────────────
    REGION_ORDER = [
        "Méditerranée : les premiers pas de Grégal",
        "Sardaigne", "Corse", "Baléares", "Gibraltar : avant-après",
        "Maroc : Essaouira", "Canaries", "Cap Vert",
        "Transat aller : Cap Vert - La Barbade",
        "La Barbade", "Martinique",
        "Guadeloupe (Marie Galante - Les Saintes)",
        "La Dominique", "Grenade",
        "Les Grenadines (Carriacou - Union -Tobago Cays - Canouan - Bequia)",
        "Antigua", "Saint Martin", "Bermudes",
        "Transat retour St Martin - Bermudes - Açores - Gibraltar",
        "Açores",
    ]

    # ── Écriture des fichiers JSON ─────────────────────────────────────────
    # posts.json : tableau avec contenu (gros fichier)
    out_posts = OUT_DIR / "posts.json"
    with open(out_posts, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)
    print(f"  ✓ {len(posts)} posts → {out_posts}")

    # comments.json : dict post_id → [comments]
    out_comments = OUT_DIR / "comments.json"
    with open(out_comments, "w", encoding="utf-8") as f:
        json.dump(comments, f, ensure_ascii=False, indent=2)
    total_comments = sum(len(v) for v in comments.values())
    print(f"  ✓ {total_comments} commentaires → {out_comments}")

    # track.json
    out_track = OUT_DIR / "track.json"
    with open(out_track, "w", encoding="utf-8") as f:
        json.dump(track, f, ensure_ascii=False, indent=2)
    print(f"  ✓ {len(track)} waypoints GPS → {out_track}")

    # site.json
    site = {
        "title":       "Le Grégal",
        "subtitle":    "Une année sabbatique en voilier",
        "description": "Carnet de bord de Tom & Aude — Méditerranée, Atlantique, Antilles, 2008-2009",
        "url":         "https://fds.github.io/le-gregal",
        "post_count":  len(posts),
        "first_post":  posts[0]["published"][:10] if posts else "",
        "last_post":   posts[-1]["published"][:10] if posts else "",
        "region_order": REGION_ORDER,
        "categories":  sorted({c for p in posts for c in p["categories"]}),
    }
    out_site = OUT_DIR / "site.json"
    with open(out_site, "w", encoding="utf-8") as f:
        json.dump(site, f, ensure_ascii=False, indent=2)
    print(f"  ✓ site.json → {out_site}")

    # Résumé GPS
    gps_posts = [p for p in posts if p["gps"]]
    print(f"\n  Posts avec GPS : {len(gps_posts)}/{len(posts)}")
    for p in gps_posts:
        print(f"    [{p['published'][:10]}] {p['title'][:50]:50s}  "
              f"{p['gps']['lat']:+.4f}, {p['gps']['lon']:+.4f}")

    return posts, comments, track


if __name__ == "__main__":
    parse_feed()
