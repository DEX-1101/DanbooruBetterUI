export interface Tag {
  id: number;
  name: string;
  post_count: number;
  category: number;
  created_at: string;
  updated_at: string;
  related_tags?: string;
}

export interface Post {
  id: number;
  file_url?: string;
  large_file_url?: string;
  preview_file_url?: string;
  file_ext?: string;
  tag_string: string;
  tag_string_character: string;
  tag_string_copyright: string;
  tag_string_artist: string;
  tag_string_general: string;
  tag_string_meta: string;
  rating: string;
  image_width: number;
  image_height: number;
  created_at: string;
  score: number;
}

export interface WikiPage {
  id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface TagGroup {
  id: number;
  name: string;
  creator_id: number;
  is_active: boolean;
  tag_names: string;
  created_at: string;
  updated_at: string;
}
