export function generateSlug(name: string, minLength = 3, maxLength = 150): string | null {
    const slug = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .replace(/-+$/g, '');
  
    if(slug.length < minLength || slug.length > maxLength) {
        return null;
    }
    return slug;
}