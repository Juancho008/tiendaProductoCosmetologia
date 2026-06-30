// Configuración del frontend.
//
// apiBase: dónde vive la API (catálogo, admin, imágenes).
//   - Dejar "" si el sitio y la API están en el MISMO dominio
//     (servidor Node local, o todo en el Worker de Cloudflare).
//   - Si el frontend está en Vercel y la API en el Worker de Cloudflare,
//     poné acá la URL del Worker, por ejemplo:
//       apiBase: "https://elegance-estetica.TU-SUBDOMINIO.workers.dev"
//     (sin barra final).
window.ELEGANCE_CONFIG = {
  apiBase: "https://elegance-estetica.juanignacioespindola08.workers.dev",
  // URL pública del sitio (canonical, Open Graph, sitemap). Dejar "" para usar el dominio actual.
  siteUrl: "https://tienda-producto-cosmetologia.vercel.app"
};
