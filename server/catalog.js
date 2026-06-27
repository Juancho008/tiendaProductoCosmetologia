// Utilidades de catálogo compartidas entre el Worker de Cloudflare y el server Node.
// Modelo: { site, categories: [ { id, label, emoji, group, groupId, enabled, order, products: [...] } ] }

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Imágenes de portada (slides). Recomendado: 800 x 1200 px.
export const DEFAULT_HERO_IMAGES = [
  "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1604654894610-df63bc536371?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1556228720-195a672e8a03?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
];

function sanitizeHeroImages(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return DEFAULT_HERO_IMAGES.map((fallback, i) => {
    const value = String(list[i] || "").trim();
    return value || fallback;
  });
}

// Textos de los slides de portada. Usar *palabra* para resaltar en dorado.
export const DEFAULT_SLIDES = [
  { lines: ["Productos de", "belleza y *Nutrición.*", "Cuidado integral", "para *ti.*"] },
  { lines: ["Capacitación y", "*Ventas.* Impulsa", "tu camino hacia", "el *éxito.*"] },
];

export const DEFAULT_SIDE_TEXT = { title: "Beauty", subtitle: "Colección Bordó" };

function sanitizeSlides(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return DEFAULT_SLIDES.map((def, i) => {
    const src = list[i];
    if (!src || !Array.isArray(src.lines)) return { lines: [...def.lines] };
    const lines = def.lines.map((_, j) => String(src.lines[j] ?? "").slice(0, 80));
    return { lines };
  });
}

function sanitizeSideText(raw) {
  const src = raw || {};
  return {
    title: String(src.title ?? DEFAULT_SIDE_TEXT.title).slice(0, 60),
    subtitle: String(src.subtitle ?? DEFAULT_SIDE_TEXT.subtitle).slice(0, 60),
  };
}

// Testimonios de clientes mostrados en la pestaña "Clientes".
export const DEFAULT_CLIENTS = [
  {
    name: "María González",
    comment:
      "Los productos son de excelente calidad y la atención es impecable. ¡Volveré seguro!",
    image: "",
  },
  {
    name: "Carla Ruiz",
    comment:
      "Me encantó el asesoramiento personalizado. Mi piel nunca se sintió mejor.",
    image: "",
  },
  {
    name: "Lucía Fernández",
    comment: "Súper recomendable. Variedad, buenos precios y envíos rápidos.",
    image: "",
  },
];

function clampStars(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 5;
  return Math.max(0, Math.min(5, n));
}

function sanitizeRating(value) {
  const s = String(value ?? "").trim().replace(/[^0-9.,]/g, "").replace(",", ".");
  return s.slice(0, 4) || "4.9";
}

function sanitizeClients(raw) {
  if (!Array.isArray(raw)) return DEFAULT_CLIENTS.map((c) => ({ ...c }));
  return raw
    .slice(0, 60)
    .map((c) => ({
      name: String(c?.name ?? "").slice(0, 60),
      comment: String(c?.comment ?? "").slice(0, 400),
      image: String(c?.image ?? "").slice(0, 300),
    }))
    .filter((c) => c.name || c.comment || c.image);
}

function sanitizeProduct(raw, index, categoryId) {
  const id =
    raw && raw.id && String(raw.id).trim()
      ? String(raw.id).trim()
      : `p-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`;
  return {
    id,
    name: String(raw?.name || "").trim() || "Sin nombre",
    price: Math.max(0, Math.round(Number(raw?.price) || 0)),
    description: String(raw?.description || "").trim(),
    code: String(raw?.code || "").trim(),
    available: raw?.available !== false,
    image: String(raw?.image || "").trim(),
    category: categoryId || String(raw?.category || "").trim(),
  };
}

function resolveGroupId(raw, group) {
  if (!group) return undefined;
  if (raw?.groupId) return String(raw.groupId).trim();
  return slugify(group);
}

function sanitizeCategory(raw, index) {
  const label = String(raw?.label || "").trim() || "Sin nombre";
  const id =
    (raw?.id && String(raw.id).trim()) || slugify(label) || `cat-${index + 1}`;
  const group = raw?.group ? String(raw.group).trim() : undefined;
  const groupId = resolveGroupId(raw, group);
  const products = Array.isArray(raw?.products) ? raw.products : [];
  return {
    id,
    label,
    emoji: String(raw?.emoji || "").trim() || "✨",
    group,
    groupId,
    enabled: raw?.enabled !== false,
    order: Number(raw?.order) || index + 1,
    products: products.map((p, i) => sanitizeProduct(p, i, id)),
  };
}

function resolveCategories(raw) {
  if (Array.isArray(raw?.categories)) {
    return raw.categories.map(sanitizeCategory);
  }

  if (!Array.isArray(raw?.products)) return [];

  return [
    sanitizeCategory(
      {
        id: "productos",
        label: "Productos",
        emoji: "💄",
        enabled: true,
        order: 1,
        products: raw.products,
      },
      0
    ),
  ];
}

/** Acepta el modelo nuevo (categories) o el viejo (products planos) y devuelve siempre el nuevo. */
export function sanitizeCatalog(raw) {
  const site = {
    storeName: String(raw?.site?.storeName || raw?.store?.name || "Beauty").trim(),
    tagline: String(
      raw?.site?.tagline || raw?.store?.tagline || "Belleza Premium"
    ).trim(),
    whatsappNumber: String(
      raw?.site?.whatsappNumber || raw?.whatsappNumber || ""
    ).replace(/[^0-9]/g, ""),
    heroImages: sanitizeHeroImages(raw?.site?.heroImages),
    slides: sanitizeSlides(raw?.site?.slides),
    sideText: sanitizeSideText(raw?.site?.sideText),
    clients: sanitizeClients(raw?.site?.clients),
    clientsStars: clampStars(raw?.site?.clientsStars),
    clientsRating: sanitizeRating(raw?.site?.clientsRating),
  };

  return {
    site,
    categories: resolveCategories(raw),
    generatedAt: new Date().toISOString(),
  };
}

/** Versión pública: solo categorías habilitadas y productos disponibles. */
export function publicCatalog(catalog) {
  const clean = sanitizeCatalog(catalog);
  return {
    site: clean.site,
    categories: clean.categories
      .filter((c) => c.enabled !== false)
      .map((c) => ({
        ...c,
        products: c.products.filter((p) => p.available !== false),
      }))
      .filter((c) => c.products.length > 0),
  };
}
