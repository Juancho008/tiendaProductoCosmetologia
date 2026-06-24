import { seedCatalog } from "../server/seed.js";
import { slugify, sanitizeCatalog, publicCatalog } from "../server/catalog.js";

const CATALOG_KEY = "catalog";
const IMG_PREFIX = "img:";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS,
      ...extra,
    },
  });
}

function adminPassword(env) {
  return env.ADMIN_PASSWORD || "elegance2026";
}

function isAuthed(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return token === adminPassword(env);
}

async function getCatalog(env) {
  const raw = await env.CATALOG_KV.get(CATALOG_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fall through to seed */
    }
  }
  const seeded = JSON.parse(JSON.stringify(seedCatalog));
  await env.CATALOG_KV.put(CATALOG_KEY, JSON.stringify(seeded));
  return seeded;
}

async function handleApi(request, env, url) {
  const { pathname } = url;
  const method = request.method;

  if (pathname === "/api/catalog" && method === "GET") {
    const catalog = await getCatalog(env);
    return new Response(JSON.stringify(publicCatalog(catalog)), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, must-revalidate",
        ...CORS,
      },
    });
  }

  if (pathname === "/api/admin/login" && method === "POST") {
    let body = {};
    try {
      body = await request.json();
    } catch {
      /* ignore */
    }
    if (body.password !== adminPassword(env)) {
      return json({ error: "Contraseña incorrecta" }, 401);
    }
    return json({ token: adminPassword(env) });
  }

  if (pathname === "/api/admin/catalog" && method === "GET") {
    if (!isAuthed(request, env)) return json({ error: "No autorizado" }, 401);
    return json(sanitizeCatalog(await getCatalog(env)));
  }

  if (pathname === "/api/admin/catalog" && method === "PUT") {
    if (!isAuthed(request, env)) return json({ error: "No autorizado" }, 401);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }
    const clean = sanitizeCatalog(body);
    await env.CATALOG_KV.put(CATALOG_KEY, JSON.stringify(clean));
    return json({ ok: true, catalog: clean });
  }

  if (pathname === "/api/admin/upload" && method === "POST") {
    if (!isAuthed(request, env)) return json({ error: "No autorizado" }, 401);
    let form;
    try {
      form = await request.formData();
    } catch {
      return json({ error: "Formulario inválido" }, 400);
    }
    const file = form.get("image");
    if (!file || typeof file.arrayBuffer !== "function") {
      return json({ error: "No se recibió ninguna imagen" }, 400);
    }
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type || "")) {
      return json({ error: "Formato de imagen no soportado" }, 400);
    }
    const buffer = await file.arrayBuffer();
    if (buffer.byteLength > 10 * 1024 * 1024) {
      return json({ error: "La imagen supera los 10 MB" }, 400);
    }
    const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
    const base = slugify((file.name || "img").replace(/\.[^.]+$/, "")).slice(0, 40) || "img";
    const name = `${Date.now()}-${base}.${ext}`;
    await env.CATALOG_KV.put(IMG_PREFIX + name, buffer, {
      metadata: { contentType: file.type || "image/jpeg" },
    });
    return json({ url: `/img/${name}` });
  }

  return json({ error: "Ruta no encontrada" }, 404);
}

async function handleImage(request, env, url) {
  const name = decodeURIComponent(url.pathname.slice("/img/".length));
  if (!name) return new Response("Not found", { status: 404 });
  const { value, metadata } = await env.CATALOG_KV.getWithMetadata(
    IMG_PREFIX + name,
    { type: "arrayBuffer" }
  );
  if (!value) return new Response("Not found", { status: 404 });
  return new Response(value, {
    headers: {
      "Content-Type": metadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=604800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    if (url.pathname.startsWith("/img/")) {
      return handleImage(request, env, url);
    }

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return env.ASSETS.fetch(new Request(new URL("/admin.html", url), request));
    }

    return env.ASSETS.fetch(request);
  },
};
