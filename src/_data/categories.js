import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawCategories = JSON.parse(readFileSync(join(__dirname, 'categoriesRaw.json'), 'utf-8'));
const allPosts      = JSON.parse(readFileSync(join(__dirname, 'posts.json'),          'utf-8'));

// For each macro-stage: constituent sub-category slugs + date range
// (date range catches unlabelled posts that fall in that period)
const MACRO_STAGES = {
  'disponibilite-et-annee-sabbatique': {
    subCats: [
      'disponibilite-et-annee-sabbatique',
      'acheter-un-voilier-d-occasion',
      'glenans',
      // 'travaux' exclu des sous-cats : ses posts de jan 2009 (Grenade)
      // seraient remontés ici. La date range < 2008-08-02 suffit pour
      // capturer tous les vrais posts de préparation.
    ],
    dateMin: null,
    dateMax: '2008-08-02',
  },
  'mediterranee-les-premiers-pas-de-gregal': {
    subCats: [
      'mediterranee-les-premiers-pas-de-gregal',
      'corse',
      'sardaigne',
      'baleares',
    ],
    dateMin: '2008-08-02',
    dateMax: '2008-10-04',   // inclut le 03/10 (Michka, Ponente) ; Gibraltar le 04/10
  },
  // Atlantique is a virtual category (not in categoriesRaw.json), built below
  'transat-aller-cap-vert-la-barbade': {
    subCats: ['transat-aller-cap-vert-la-barbade'],
    dateMin: '2008-12-05',
    dateMax: '2008-12-26',
  },
  'escales-et-terres-nouvelles': {
    subCats: [
      'escales-et-terres-nouvelles',
      'la-barbade',
      'grenade',
      'les-grenadines-carriacou-union-tobago-cays-canouan-bequia',
      'martinique',
      'guadeloupe-marie-galante-les-saintes',
      'la-dominique',
      'antigua',
      'saint-martin',
    ],
    dateMin: '2008-12-26',
    dateMax: '2009-05-13',
  },
  'transat-retour-st-martin-bermudes-acores-gibraltar': {
    subCats: [
      'transat-retour-st-martin-bermudes-acores-gibraltar',
      'bermudes',
      'acores',
    ],
    dateMin: '2009-05-13',
    dateMax: '2009-07-07',   // à partir du 07/07 → Retour à Sète
  },
};

// Virtual Atlantique stage (Gibraltar crossing + Maroc + Canaries + Cap Vert)
const ATLANTIQUE = {
  slug:      'atlantique',
  name:      'Atlantique',
  gps_center: null,
  subCats:   ['maroc-essaouira', 'canaries', 'cap-vert', 'gibraltar-avant-apres'],
  dateMin:   '2008-10-04',   // Gibraltar le 04/10, Maroc, Canaries, Cap Vert
  dateMax:   '2008-12-05',
};

// Virtual Retour à Sète stage (arrivée via côte espagnole et Méditerranée)
const RETOUR_SETE = {
  slug:      'retour-a-sete',
  name:      'Retour à Sète',
  gps_center: null,
  subCats:   [],
  dateMin:   '2009-07-07',
  dateMax:   null,
};

const catBySlug = Object.fromEntries(rawCategories.map(c => [c.slug, c]));

function buildPosts(stage) {
  const seen  = new Set();
  const posts = [];

  const add = (post) => {
    if (!seen.has(post.slug)) {
      seen.add(post.slug);
      posts.push(post);
    }
  };

  // 1. Posts from constituent sub-categories
  for (const subSlug of stage.subCats) {
    const subCat = catBySlug[subSlug];
    if (subCat) {
      for (const post of subCat.posts || []) add(post);
    }
  }

  // 2. Posts whose date falls in the stage's date range
  //    (catches posts with no geographic label)
  for (const post of allPosts) {
    const d = post.published.slice(0, 10);
    const inRange =
      (!stage.dateMin || d >= stage.dateMin) &&
      (!stage.dateMax || d <  stage.dateMax);
    if (inRange) add(post);
  }

  posts.sort((a, b) => a.published.localeCompare(b.published));
  return posts;
}

// Build enriched categories from rawCategories
const enriched = rawCategories.map(cat => {
  const stage = MACRO_STAGES[cat.slug];
  if (!stage) return cat;
  const posts = buildPosts(stage);
  return { ...cat, posts, post_count: posts.length };
});

// Insert virtual Atlantique category after Méditerranée
const atlantiquePosts = buildPosts(ATLANTIQUE);
const atlantiqueCat = {
  slug:       ATLANTIQUE.slug,
  name:       ATLANTIQUE.name,
  gps_center: ATLANTIQUE.gps_center,
  post_count: atlantiquePosts.length,
  posts:      atlantiquePosts,
};
const medIdx = enriched.findIndex(c => c.slug === 'mediterranee-les-premiers-pas-de-gregal');
enriched.splice(medIdx + 1, 0, atlantiqueCat);

// Append virtual Retour à Sète category at the end
const retourSetePosts = buildPosts(RETOUR_SETE);
enriched.push({
  slug:       RETOUR_SETE.slug,
  name:       RETOUR_SETE.name,
  gps_center: RETOUR_SETE.gps_center,
  post_count: retourSetePosts.length,
  posts:      retourSetePosts,
});

export default enriched;
