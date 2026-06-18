

export interface CloudflareImageURLParams {
    width?: number;
    height?: number;
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
    format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png' | 'json';
    quality?: number; // 1-100
    gravity?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'center';
    // Note: For URLs, hex color codes must be URL-encoded (e.g., %23FFFFFF instead of #FFFFFF)
    background?: string; 
  }
  
  // 2. Define the transformation configurations for different UI needs
  export const imageUrlTransforms = {

    blurryPlaceholder: { width: 50, quality: 20, blur: 50, format: 'auto'},
    
    avatars: {
      // 40x40 displayed -> 80x80 requested (2x)
      micro: { width: 80, height: 80, fit: 'cover', gravity: 'auto', format: 'auto' },
      // 64x64 displayed -> 128x128 requested (2x)
      small: { width: 128, height: 128, fit: 'cover', gravity: 'auto', format: 'auto' },
      // 150x150 displayed -> 300x300 requested (2x)
      large: { width: 300, height: 300, fit: 'cover', gravity: 'auto', format: 'auto' },
    },
  
    thumbnails: {
      // 250x250 displayed -> 500x500 requested (2x)
      small: { width: 500, format: 'webp', quality: 80 },
      // 320x180 displayed -> 640x360 requested (2x)
      large: { width: 800, format: 'webp', quality: 80 },
    },
  
    previews: {
      // 600x337 displayed -> 1200x674 requested (2x)
      contentCard: { width: 1200, format: 'webp', quality: 80 },
      // E-commerce: padding is often better than cropping to show the whole product
      // Notice %23 for URL-encoded '#'
      ecommerce: { width: 1600, height: 1600, fit: 'pad', background: '%23ffffff', format: 'auto' },
      // Open Graph standard size (1200x630)
      openGraph: { width: 1200, height: 630, fit: 'cover', format: 'auto', quality: 85 }
    },
  
    fullscreen: {
      // scale-down ensures it never exceeds HD dimensions but keeps original aspect ratio
      hdDesktop: { width: 1920, height: 1080, fit: 'scale-down', format: 'auto', quality: 80 },
      maxResolution: { width: 2560, height: 1440, fit: 'scale-down', format: 'auto', quality: 75 }
    },
  
    heroes: {
      desktop: { width: 1920, fit: 'scale-down', format: 'auto', quality: 80 },
      mobile: { width: 1080, fit: 'scale-down', format: 'auto', quality: 80 }
    }
} as const;

export const buildOptimizeddImageUrl = (
    sourceUrl: string, 
    options: CloudflareImageURLParams,
  ): string => {

    const cdnUrl = import.meta.env.VITE_MEDIA_CDN_URL
    if (!cdnUrl) {
      throw new Error('VITE_MEDIA_CDN_URL is not set')
    }

    // Convert the options object into a comma-separated string (e.g., "width=500,height=500,fit=cover")
    const optionsString = Object.entries(options)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
  
    // Construct the final URL. 
    // Example result: /cdn-cgi/image/width=500,height=500,fit=cover/https://example.com/image.jpg
    return `${cdnUrl.replace(/\/$/, '')}/${optionsString}/${sourceUrl}`;
};