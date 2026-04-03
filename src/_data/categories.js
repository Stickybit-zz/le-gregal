import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawCategories = JSON.parse(readFileSync(join(__dirname, 'categoriesRaw.json'), 'utf-8'));
const allPosts     = JSON.parse(readFileSync(join(__dirname, 'posts.json'),          'utf-8'));

// For each macro-stage: constituent sub-category slugs + date range
// (date range catches unlabelled posts that fall in that period)
const MACRO_STAGES = {
  'disponibilite-et-annee-sabbatique': {
    subCats: [
      'disponibilite-et-annee-sabbatique',
      'acheter-un-voilier-d-occasion',
      'glenans',
      'travaux',
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
      'maroc-essaouira',
      'gibraltar-avant-apres',
      'canaries',
      'cap-vert',
    ],
    dateMin: '2008-08-02',
    dateMax: '2008-12-05',
  },
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
    dateMax: null,
  },
};

const catBySlug = Object.fromEntries(rawCategories.map(c => [c.slug, c]));

export default rawCategories.map(cat => {
  const stage = MACRO_STAGES[cat.slug];
  if (!stage) return cat;

  const seen  = new Set();
  const posts = [];

  const add = (post) => {
    if (!seen.has(post.slug)) {
      seen.add(post.slug);
      posts.push(post);
    }
  };

  // 1. Posts from each constituent sub-category
  for (const subSlug of stage.subCats) {
    const subCat = catBySlug[subSlug];
    if (subCat) {
      for (const post of subCat.posts || []) add(post);
    }
  }

  // 2. All posts whose date falls in the stage's date range
  //    (catches posts with no geographic label)
  for (const post of allPosts) {
    const d = post.published.slice(0, 10);
    const inRange =
      (!stage.dateMin || d >= stage.dateMin) &&
      (!stage.dateMax || d <  stage.dateMax);
    if (inRange) add(post);
  }

  posts.sort((a, b) => a.published.localeCompare(b.published));

  return { ...cat, posts, post_count: posts.length };
});
