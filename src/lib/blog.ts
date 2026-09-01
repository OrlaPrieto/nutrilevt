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

  // 1. Transformar Consejos Clínicos
  // Caso A: Múltiples <blockquote> consecutivos (como genera Quill al tener varias líneas en blockquote)
  formatted = formatted.replace(
    /<blockquote>\s*(?:<p>)?\s*(?:<strong>)?\s*💡\s*(?:Consejo|Clinical)[^<]*?(?:<\/strong>)?\s*(?:<\/p>)?\s*<\/blockquote>((?:\s*<blockquote>(?!\s*(?:<p>)?\s*(?:<strong>)?\s*[💡🩺])[\s\S]*?<\/blockquote>)+)/gi,
    (_match, consecutiveQuotes) => {
      const quoteContents: string[] = [];
      const quoteRegex = /<blockquote>([\s\S]*?)<\/blockquote>/gi;
      let qMatch;
      while ((qMatch = quoteRegex.exec(consecutiveQuotes)) !== null) {
        const inner = qMatch[1].replace(/<\/?p>/gi, '').trim();
        if (inner) quoteContents.push(inner);
      }
      const bodyText = quoteContents.map(c => `<p>${c}</p>`).join('');
      return `
<div class="clinical-tip-box not-prose">
  <div class="tip-header">💡 Consejo Clínico de la Nutrióloga</div>
  ${bodyText}
</div>`;
    }
  );

  // Caso B: Un solo <blockquote> con título y texto
  formatted = formatted.replace(
    /<blockquote>\s*(?:<p>)?\s*(?:<strong>)?\s*💡\s*(?:Consejo|Clinical)[^<:]*:?(?:<\/strong>)?\s*(?:<br\/?>)?\s*([^\s<][\s\S]*?)(?:<\/p>)?\s*<\/blockquote>/gi,
    (_match, textContent) => {
      const cleaned = textContent.replace(/<\/?(blockquote|p)>/gi, '').trim();
      return `
<div class="clinical-tip-box not-prose">
  <div class="tip-header">💡 Consejo Clínico de la Nutrióloga</div>
  <p>${cleaned}</p>
</div>`;
    }
  );

  // Caso C: En párrafos <p>
  formatted = formatted.replace(
    /<p>\s*(?:<strong>)?\s*💡\s*(?:Consejo|Clinical)[^<]*?(?:<\/strong>)?\s*<\/p>\s*<p>([\s\S]*?)<\/p>/gi,
    (_match, text) => {
      return `
<div class="clinical-tip-box not-prose">
  <div class="tip-header">💡 Consejo Clínico de la Nutrióloga</div>
  <p>${text.trim()}</p>
</div>`;
    }
  );

  // 2. Transformar Mitos vs Realidad (en <p> o en <blockquote>)
  formatted = formatted.replace(
    /(?:<div class="myth-reality-box[\s\S]*?<\/div>|<(?:p|blockquote)>\s*(?:<strong>)?\s*❌\s*(?:Mito|Myth)[^:]*:(?:<\/strong>)?\s*([\s\S]*?)<\/(?:p|blockquote)>\s*<(?:p|blockquote)>\s*(?:<strong>)?\s*✅\s*(?:Realidad|Reality)[^:]*:(?:<\/strong>)?\s*([\s\S]*?)<\/(?:p|blockquote)>)/gi,
    (match, mythText, realityText) => {
      if (match.includes('class="myth-reality-box"')) return match;
      return `
<div class="myth-reality-box not-prose">
  <div class="myth-card">
    <div class="card-title">❌ Mito Frecuente</div>
    <p>${mythText.replace(/<\/?(strong|em)>/gi, '').trim()}</p>
  </div>
  <div class="reality-card">
    <div class="card-title">✅ Realidad Basada en Evidencia</div>
    <p>${realityText.replace(/<\/?(strong|em)>/gi, '').trim()}</p>
  </div>
</div>`;
    }
  );

  // 3. Transformar Tarjetas de Recetas (Título con emoji o Receta: + Meta opcional + Ingredientes + Lista <ol> o <ul>)
  let recipeCounter = 0;
  formatted = formatted.replace(
    /(?:<div class="recipe-card[\s\S]*?<\/div>|<(?:p|h[2-4])\s*[^>]*>\s*(?:<strong>)?\s*(?:[🥗🥑🍳🥣🥞🥘🍲🥪🥙]|(?:Receta|Recipe):?)[\s\S]*?<\/(?:p|h[2-4])>\s*(?:<p\s*[^>]*>\s*(?:<em>)?\s*([⏱️⏰🍴🍽️🥑][^<]+?)(?:<\/em>)?\s*<\/p>)?(?:\s*<(?:p|h[2-4])\s*[^>]*>\s*(?:<strong>)?\s*(?:Ingredientes[^<]*?|Ingredients[^<]*?)(?:<\/strong>)?\s*<\/(?:p|h[2-4])>)?\s*<(?:ul|ol)[^>]*>([\s\S]*?)<\/(?:ul|ol)>)/gi,
    (match, metaStr, listItems) => {
      if (match.includes('class="recipe-card"')) return match;
      recipeCounter++;
      const currentRecipeId = recipeCounter;

      // Extraer título limpio de la primera etiqueta de encabezado/párrafo
      const titleMatch = match.match(/<(?:p|h[2-4])[^>]*>([\s\S]*?)<\/(?:p|h[2-4])>/i);
      const fullTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Receta Saludable';

      let metaHtml = '';
      if (metaStr) {
        const metaParts = metaStr.split('|').map((s: string) => s.trim()).filter(Boolean);
        metaHtml = metaParts.map((item: string) => `<span class="recipe-meta-item">${item}</span>`).join('');
      }

      const checklistItems: string[] = [];
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      let itemIdx = 0;
      while ((liMatch = liRegex.exec(listItems)) !== null) {
        itemIdx++;
        const ingredient = liMatch[1]
          .replace(/<span class="ql-ui"[^>]*>.*?<\/span>/gi, '')
          .replace(/<[^>]+>/gi, '')
          .trim();
        if (ingredient) {
          checklistItems.push(`
          <li>
            <label class="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" id="rec-${currentRecipeId}-${itemIdx}" onchange="this.nextElementSibling.classList.toggle('line-through', this.checked); this.nextElementSibling.classList.toggle('opacity-60', this.checked);" />
              <span>${ingredient}</span>
            </label>
          </li>
        `);
        }
      }

      return `
<div class="recipe-card not-prose">
  <div class="recipe-header">
    <h3 class="recipe-title">${fullTitle}</h3>
    ${metaHtml ? `<div class="recipe-meta">${metaHtml}</div>` : ''}
  </div>
  <div class="recipe-ingredients-title">Ingredientes necesarios:</div>
  <ul class="recipe-checklist">
    ${checklistItems.join('')}
  </ul>
</div>`;
    }
  );

  // 4. Transformar Banner de Agendar Consulta (CTA In-Article)
  formatted = formatted.replace(
    /(?:<div class="in-article-cta[\s\S]*?<\/div>|<blockquote>\s*(?:<p>)?\s*(?:<strong>)?\s*(🩺[^<]+?)(?:<\/strong>)?\s*(?:<\/p>)?\s*<\/blockquote>\s*<blockquote>\s*(?:<p>)?\s*([\s\S]*?)\s*(?:<\/p>)?\s*<\/blockquote>\s*<blockquote>\s*(?:<p>)?\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*(?:<\/p>)?\s*<\/blockquote>|<blockquote>([\s\S]*?🩺[\s\S]*?<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?)<\/blockquote>|<p>\s*(?:<strong>)?\s*(🩺[^<]+?)(?:<\/strong>)?\s*<\/p>\s*<p>\s*([\s\S]*?)\s*<\/p>\s*<p>\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/p>)/gi,
    (match, b1Title, b1Desc, b1Href, b1Text, singleBq, sHref, sText, pTitle, pDesc, pHref, pText) => {
      if (match.includes('class="in-article-cta"')) return match;

      let title = b1Title || pTitle || '🩺 ¿Buscas un plan adaptado a tu metabolismo?';
      let desc = b1Desc || pDesc || '';
      let href = b1Href || sHref || pHref || '/#booking';
      let text = b1Text || sText || pText || '👉 Agendar Consulta Personalizada';

      if (singleBq && !b1Title && !pTitle) {
        const titleMatch = singleBq.match(/🩺[^<]+/i);
        if (titleMatch) title = titleMatch[0].trim();
        desc = singleBq
          .replace(/<a[\s\S]*?<\/a>/gi, '')
          .replace(/🩺[^<]+/gi, '')
          .replace(/<\/?(blockquote|p|strong|br)>/gi, ' ')
          .trim();
      }

      title = title.replace(/<\/?(strong|p|blockquote)>/gi, '').trim();
      desc = desc.replace(/<\/?(strong|p|blockquote)>/gi, '').trim();
      text = text.replace(/<\/?(strong|p)>/gi, '').trim();

      return `
<div class="in-article-cta not-prose">
  <h4>${title}</h4>
  <p>${desc}</p>
  <a href="${href}">${text}</a>
</div>`;
    }
  );

  return formatted;
}


