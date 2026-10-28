import { SITE_URL } from '@/lib/config';
import { fetchCourses } from '@/lib/server-api';

// Built per request (cached API data, 10 min): the API is not reachable during `next build`.
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100; // API maximum
const MAX_PAGES = 50;

export default async function sitemap() {
  const entries = [{ url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 }];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const { data } = await fetchCourses({ page, limit: PAGE_SIZE, revalidate: 600 });
    if (!data) break;
    for (const course of data.items) {
      entries.push({
        url: `${SITE_URL}/courses/${encodeURIComponent(course.slug)}`,
        lastModified: course.updatedAt ? new Date(course.updatedAt) : undefined,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
    if (page * PAGE_SIZE >= data.total) break;
  }
  return entries;
}
