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

function sanitizeCategory(raw, index) {
  const label = String(raw?.label || "").trim() || "Sin nombre";
  const id =
    (raw?.id && String(raw.id).trim()) || slugify(label) || `cat-${index + 1}`;
  const group = raw?.group ? String(raw.group).trim() : undefined;
  const groupId = group
    ? raw?.groupId
      ? String(raw.groupId).trim()
      : slugify(group)
    : undefined;
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

/** Acepta el modelo nuevo (categories) o el viejo (products planos) y devuelve siempre el nuevo. */
export function sanitizeCatalog(raw) {
  const site = {
    storeName: String(raw?.site?.storeName || raw?.store?.name || "Élégance").trim(),
    tagline: String(
      raw?.site?.tagline || raw?.store?.tagline || "Belleza Premium"
    ).trim(),
    whatsappNumber: String(
      raw?.site?.whatsappNumber || raw?.whatsappNumber || ""
    ).replace(/[^0-9]/g, ""),
  };

  let categories;
  if (Array.isArray(raw?.categories)) {
    categories = raw.categories.map(sanitizeCategory);
  } else if (Array.isArray(raw?.products)) {
    categories = [
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
  } else {
    categories = [];
  }

  return { site, categories, generatedAt: new Date().toISOString() };
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
