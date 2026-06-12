import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/moderator/',
        '/seller/',
        '/delivery/',
        '/checkout/',
        '/cart/',
      ],
    },
    sitemap: 'https://ziprocket.in/sitemap.xml',
  };
}
