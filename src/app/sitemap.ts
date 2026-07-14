import type { MetadataRoute } from 'next';
import { SITE, TOOLS } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['/', ...TOOLS.map((t) => `${t.href}/`), '/about/'];
  const lastModified = new Date();
  return paths.map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified,
    changeFrequency: 'monthly',
    priority: path === '/' ? 1 : 0.8,
  }));
}
