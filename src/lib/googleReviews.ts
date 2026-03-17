import { ui, defaultLang } from "../i18n/ui";

export interface Review {
  name: string;
  initials: string;
  color: string;
  service: string;
  rating: number;
  date: string;
  text: string;
  highlight?: string;
}

const COLORS = ["#d4a5c9", "#a5c4d4", "#c4d4a5", "#d4c4a5", "#c4a5d4", "#FFD1DC"];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export interface ReviewStats {
  rating: number;
  userRatingsTotal: number;
}

export async function getGoogleReviews(lang: string = "es"): Promise<{ reviews: Review[]; stats: ReviewStats }> {
  const apiKey = import.meta.env.GOOGLE_PLACES_API_KEY;
  const placeId = import.meta.env.GOOGLE_PLACE_ID || "ChIJ76Zf87Nc6oYROH77rHH3caM"; // Default to possible ID if not set

  // If no API key, return static testimonials as fallback
  if (!apiKey) {
    console.warn("GOOGLE_PLACES_API_KEY not found. Using static testimonials.");
    return { 
      reviews: getStaticTestimonials(lang),
      stats: { rating: 5.0, userRatingsTotal: 34 } // Example default stats
    };
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&key=${apiKey}&language=${lang}`
    );
    const data = await response.json();

    if (data.status !== "OK") {
      console.error("Google Places API Error:", data.status, data.error_message);
      return { 
        reviews: getStaticTestimonials(lang),
        stats: { rating: 5.0, userRatingsTotal: 34 }
      };
    }

    let reviews = data.result.reviews ? data.result.reviews.map((r: any) => ({
      name: r.author_name,
      initials: getInitials(r.author_name),
      color: getColor(r.author_name),
      service: lang === "es" ? "Consulta Nutricional" : "Nutritional Consultation", 
      rating: r.rating,
      date: r.relative_time_description,
      text: r.text,
      highlight: r.text.split(".")[0],
    })) : getStaticTestimonials(lang);

    // Padding up to 6 reviews if we have fewer (Google only gives 5)
    if (reviews.length < 6) {
      const staticOnes = getStaticTestimonials(lang);
      const needed = 6 - reviews.length;
      reviews = [...reviews, ...staticOnes.slice(0, needed)];
    } else {
      reviews = reviews.slice(0, 6);
    }

    return {
      reviews,
      stats: {
        rating: data.result.rating || 5.0,
        userRatingsTotal: data.result.user_ratings_total || reviews.length
      }
    };
  } catch (error) {
    console.error("Failed to fetch Google reviews:", error);
    return { 
      reviews: getStaticTestimonials(lang),
      stats: { rating: 5.0, userRatingsTotal: 34 }
    };
  }
}

function getStaticTestimonials(lang: string): Review[] {
  const t = ui[lang as keyof typeof ui] || ui[defaultLang];
  
  // Mapping the existing hardcoded IDs for consistency
  return [
    {
      name: t['testimonials.t1.name'],
      initials: "CT",
      color: "#d4a5c9",
      service: t['services.weight.title'],
      rating: 5,
      date: lang === 'es' ? "Enero 2025" : "January 2025",
      text: t['testimonials.t1.text'],
      highlight: t['testimonials.t1.highlight'],
    },
    {
      name: t['testimonials.t2.name'],
      initials: "AH",
      color: "#a5c4d4",
      service: t['services.clinical.title'],
      rating: 5,
      date: lang === 'es' ? "Noviembre 2024" : "November 2024",
      text: t['testimonials.t2.text'],
      highlight: t['testimonials.t2.highlight'],
    },
    {
      name: t['testimonials.t3.name'],
      initials: "KC", // Fixed from "AH" in original which seemed typo
      color: "#c4d4a5",
      service: t['services.psycho.title'],
      rating: 5,
      date: lang === 'es' ? "Octubre 2024" : "October 2024",
      text: t['testimonials.t3.text'],
      highlight: t['testimonials.t3.highlight'],
    },
    {
      name: t['testimonials.t4.name'],
      initials: "DD",
      color: "#d4c4a5",
      service: t['services.hormone.title'],
      rating: 5,
      date: lang === 'es' ? "Septiembre 2024" : "September 2024",
      text: t['testimonials.t4.text'],
      highlight: t['testimonials.t4.highlight'],
    },
    {
      name: t['testimonials.t5.name'],
      initials: "AE",
      color: "#c4a5d4",
      service: t['services.psycho.title'],
      rating: 5,
      date: lang === 'es' ? "Agosto 2024" : "August 2024",
      text: t['testimonials.t5.text'],
      highlight: t['testimonials.t5.highlight'],
    },
    {
      name: t['testimonials.t6.name'],
      initials: "RM",
      color: "#FFD1DC",
      service: t['services.sports.title'],
      rating: 5,
      date: lang === 'es' ? "Julio 2024" : "July 2024",
      text: t['testimonials.t6.text'],
      highlight: t['testimonials.t6.highlight'],
    },
  ];
}
