import { supabase } from './supabase';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  category: string;
  reading_time: string;
  lang: 'es' | 'en';
  published: boolean;
  created_at: string;
  updated_at: string;
}

export type BlogPostInput = Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>;

/**
 * Convierte un título en un slug amigable para URLs
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD') // Normaliza acentos y diacríticos
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Calcula el tiempo estimado de lectura en minutos
 */
export function calculateReadingTime(text: string): string {
  const wordsPerMinute = 200;
  const cleanText = text.replace(/<[^>]*>?/gm, ''); // Remueve etiquetas HTML
  const words = cleanText.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${Math.max(1, minutes)} min`;
}

/**
 * Formatea una fecha ISO a formato legible según idioma
 */
export function formatBlogDate(dateStr: string, lang: 'es' | 'en' = 'es'): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-MX' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

/**
 * Obtiene todos los artículos publicados para el portal público
 */
export async function getPublishedPosts(lang: 'es' | 'en' = 'es'): Promise<BlogPost[]> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('lang', lang)
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching published posts:', error.message);
      return [];
    }

    return (data as BlogPost[]) || [];
  } catch (err) {
    console.error('Unexpected error fetching posts:', err);
    return [];
  }
}

/**
 * Obtiene un artículo publicado específico por su slug e idioma
 */
export async function getPostBySlug(slug: string, lang: 'es' | 'en' = 'es'): Promise<BlogPost | null> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('slug', slug)
      .eq('lang', lang)
      .eq('published', true)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching post with slug "${slug}":`, error.message);
      return null;
    }

    return data as BlogPost | null;
  } catch (err) {
    console.error('Unexpected error fetching post by slug:', err);
    return null;
  }
}

/**
 * Obtiene los artículos más recientes excluyendo uno específico (para recomendaciones)
 */
export async function getRelatedPosts(currentSlug: string, lang: 'es' | 'en' = 'es', limit: number = 2): Promise<BlogPost[]> {
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('lang', lang)
      .eq('published', true)
      .neq('slug', currentSlug)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching related posts:', error.message);
      return [];
    }

    return (data as BlogPost[]) || [];
  } catch (err) {
    console.error('Unexpected error fetching related posts:', err);
    return [];
  }
}

/**
 * Sube una imagen a Supabase Storage en el bucket 'blog-images'
 */
export async function uploadBlogImage(file: File): Promise<{ url: string | null; error: string | null }> {
  try {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${Date.now()}-${cleanFileName}.${fileExt}`;
    const filePath = `posts/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('blog-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      return { url: null, error: uploadError.message };
    }

    const { data } = supabase.storage
      .from('blog-images')
      .getPublicUrl(filePath);

    return { url: data.publicUrl, error: null };
  } catch (err: any) {
    return { url: null, error: err.message || 'Error al subir la imagen' };
  }
}

/**
 * Verifica si el usuario con sesión activa pertenece a la tabla blog_admins
 */
export async function checkIsBlogAdmin(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const { data, error } = await supabase
      .from('blog_admins')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Transforma y asegura el renderizado de cajas editoriales (Consejos, Mitos, Recetas, CTAs)
 */
export function formatBlogContent(content: string): string {
  if (!content) return '';

  let formatted = content;

  // 1. Transformar Consejos Clínicos (si vienen en texto plano <p> o <blockquote>)
  formatted = formatted.replace(
    /(?:<div class="clinical-tip-box">[\s\S]*?<\/div>|<p>\s*(?:<strong>)?💡\s*Consejo[^<]*?(?:<\/strong>)?<\/p>\s*<p>([\s\S]*?)<\/p>|<blockquote>\s*(?:<p>)?\s*(?:<strong>)?💡\s*Consejo[^<]*?(?:<\/strong>)?\s*(?:<br\/?>)?\s*([\s\S]*?)(?:<\/p>)?\s*<\/blockquote>)/gi,
    (match, pText, quoteText) => {
      if (match.includes('class="clinical-tip-box"')) return match;
      const text = pText || quoteText || match.replace(/💡[^<]*/, '').replace(/<\/?(blockquote|p|strong|br)>/g, ' ').trim();
      return `
<div class="clinical-tip-box">
  <div class="tip-header">💡 Consejo Clínico de la Nutrióloga</div>
  <p>${text.trim()}</p>
</div>`;
    }
  );

  // 2. Transformar Mitos vs Realidad planos a cajas de contraste
  formatted = formatted.replace(
    /<p>\s*(?:<strong>)?❌\s*Mito[^:]*:(?:<\/strong>)?\s*([\s\S]*?)<\/p>\s*<p>\s*(?:<strong>)?✅\s*Realidad[^:]*:(?:<\/strong>)?\s*([\s\S]*?)<\/p>/gi,
    (_match, mythText, realityText) => {
      return `
<div class="myth-reality-box">
  <div class="myth-card">
    <div class="card-title">❌ Mito Frecuente</div>
    <p>${mythText.trim()}</p>
  </div>
  <div class="reality-card">
    <div class="card-title">✅ Realidad Basada en Evidencia</div>
    <p>${realityText.trim()}</p>
  </div>
</div>`;
    }
  );

  return formatted;
}


