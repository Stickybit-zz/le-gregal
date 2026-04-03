// Builds a map { postSlug → étapeSlug } using the same logic as categories.js
// Used in chronologie to set data-etape on each post item.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw      = JSON.parse(readFileSync(new URL('./categoriesRaw.json', import.meta.url)));
const allPosts = JSON.parse(readFileSync(new URL('./posts.json',         import.meta.url)));

const STAGES = [
  { slug: 'disponibilite-et-annee-sabbatique',
    subCats: ['disponibilite-et-annee-sabbatique', 'acheter-un-voilier-d-occasion', 'glenans'],
    dateMin: null,         dateMax: '2008-08-02' },
  { slug: 'mediterranee-les-premiers-pas-de-gregal',
    subCats: ['mediterranee-les-premiers-pas-de-gregal', 'corse', 'sardaigne', 'baleares'],
    dateMin: '2008-08-02', dateMax: '2008-10-04' },
  { slug: 'atlantique',
    subCats: ['maroc-essaouira', 'canaries', 'cap-vert'],
    dateMin: '2008-10-04', dateMax: '2008-12-05' },
  { slug: 'transat-aller-cap-vert-la-barbade',
    subCats: ['transat-aller-cap-vert-la-barbade'],
    dateMin: '2008-12-05', dateMax: '2008-12-26' },
  { slug: 'escales-et-terres-nouvelles',
    subCats: ['la-barbade', 'grenade',
              'les-grenadines-carriacou-union-tobago-cays-canouan-bequia',
              'martinique', 'guadeloupe-marie-galante-les-saintes',
              'la-dominique', 'antigua'],
    dateMin: '2008-12-27', dateMax: '2009-05-13' },
  { slug: 'transat-retour-st-martin-bermudes-acores-gibraltar',
    subCats: ['transat-retour-st-martin-bermudes-acores-gibraltar', 'bermudes', 'acores'],
    dateMin: '2009-05-13', dateMax: '2009-07-07' },
  { slug: 'retour-a-sete',
    subCats: [],
    dateMin: '2009-07-07', dateMax: null },
];

const catSets = Object.fromEntries(
  raw.map(c => [c.slug, new Set((c.posts || []).map(p => p.slug))])
);

const map = {};
for (const post of allPosts) {
  const d = post.published.slice(0, 10);
  for (const stage of STAGES) {
    const inSub   = stage.subCats.some(s => catSets[s]?.has(post.slug));
    const inRange = (!stage.dateMin || d >= stage.dateMin) &&
                    (!stage.dateMax || d <  stage.dateMax);
    if (inSub || inRange) {
      map[post.slug] = stage.slug;
      break;
    }
  }
}

export default map;
