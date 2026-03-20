import { Tag, Post, WikiPage, TagGroup } from './types';

const BASE_URL = 'https://danbooru.donmai.us';

/**
 * Searches for tags matching the query, ordered by popularity.
 */
export const searchTags = async (query: string): Promise<Tag[]> => {
  if (!query) return [];
  try {
    const res = await fetch(`${BASE_URL}/tags.json?search[name_matches]=*${query}*&search[order]=count&limit=10`);
    if (!res.ok) throw new Error('Failed to fetch tags');
    return await res.json();
  } catch (error) {
    console.error('Error searching tags:', error);
    return [];
  }
};

/**
 * Fetches a single tag by name to get its full details including related_tags.
 */
export const getTag = async (tagName: string): Promise<Tag | null> => {
  try {
    const res = await fetch(`${BASE_URL}/tags.json?search[name]=${tagName}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error fetching tag:', error);
    return null;
  }
};

/**
 * Fetches the wiki page for a specific tag to get its traits and description.
 */
export const getTagWiki = async (tagName: string): Promise<WikiPage | null> => {
  try {
    const res = await fetch(`${BASE_URL}/wiki_pages.json?search[title]=${tagName}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error fetching wiki:', error);
    return null;
  }
};

export const getPostById = async (id: string): Promise<Post | null> => {
  try {
    const res = await fetch(`${BASE_URL}/posts/${id}.json`);
    if (!res.ok) return null;
    const post: Post = await res.json();
    
    const fixImageUrl = (url?: string) => {
      if (!url) return url;
      if (url.startsWith('/')) url = `${BASE_URL}${url}`;
      return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    };

    return {
      ...post,
      file_url: fixImageUrl(post.file_url),
      large_file_url: fixImageUrl(post.large_file_url),
      preview_file_url: fixImageUrl(post.preview_file_url),
    };
  } catch (error) {
    console.error('Error fetching post:', error);
    return null;
  }
};

/**
 * Fetches recent posts (images) for a specific tag.
 * If safeMode is true, it appends 'rating:g' to filter out NSFW content.
 */
export const getPostsByTag = async (tagName: string, safeMode: boolean = true, page: number = 1): Promise<Post[]> => {
  try {
    const tags = safeMode ? `${tagName} rating:g` : tagName;
    const res = await fetch(`${BASE_URL}/posts.json?tags=${tags}&limit=50&page=${page}`);
    if (!res.ok) throw new Error('Failed to fetch posts');
    const posts: Post[] = await res.json();
    
    // Danbooru's CDN (cdn.donmai.us) strictly blocks hotlinking.
    // We bypass this by proxying the image through our own backend.
    const fixImageUrl = (url?: string) => {
      if (!url) return url;
      if (url.startsWith('/')) url = `${BASE_URL}${url}`;
      return `/api/proxy-image?url=${encodeURIComponent(url)}`;
    };

    return posts.map(post => ({
      ...post,
      file_url: fixImageUrl(post.file_url),
      large_file_url: fixImageUrl(post.large_file_url),
      preview_file_url: fixImageUrl(post.preview_file_url),
    }));
  } catch (error) {
    console.error('Error fetching posts:', error);
    return [];
  }
};

/**
 * Fetches tag groups.
 */
export const getTagGroups = async (page: number = 1): Promise<TagGroup[]> => {
  try {
    const res = await fetch(`${BASE_URL}/tag_groups.json?limit=50&page=${page}`);
    if (!res.ok) throw new Error('Failed to fetch tag groups');
    return await res.json();
  } catch (error) {
    console.error('Error fetching tag groups:', error);
    return [];
  }
};

/**
 * Helper to clean up Danbooru's DText (markdown) for basic display.
 * Removes links like [[tag]] or "text":/url
 */
export const cleanDText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\[\[(.*?)\]\]/g, '$1') // Remove [[tag]] brackets
    .replace(/"(.*?)":\/[^\s]+/g, '$1') // Remove "text":/url links
    .replace(/h\d\./g, '') // Remove header markers like h1., h2.
    .trim();
};
