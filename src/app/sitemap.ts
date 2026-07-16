import type { MetadataRoute } from 'next';
import { SITE, TOOLS } from '@/lib/site';
import { JSON_ERROR_GUIDES } from '@/lib/guides/jsonErrors';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    '/',
    ...TOOLS.map((t) => `${t.href}/`),
    '/guides/',
    ...JSON_ERROR_GUIDES.map((g) => `/guides/${g.slug}/`),
    '/about/',
  ];
  const lastModified = new Date();
  return paths.map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.8,
  }));
}
