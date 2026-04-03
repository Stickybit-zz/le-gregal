// Extracts the first local photo URL from each post's content.
// Returns { postSlug: '/le-gregal/photos/image.jpg', ... }
import { readFileSync } from 'fs';

const posts = JSON.parse(readFileSync(new URL('./posts.json', import.meta.url)));

const imgRe = /<img[^>]+src="(\/le-gregal\/photos\/[^"]+)"/;

const map = {};
for (const post of posts) {
  const m = post.content?.match(imgRe);
  if (m) map[post.slug] = m[1];
}

export default map;
