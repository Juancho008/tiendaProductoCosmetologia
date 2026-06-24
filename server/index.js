import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { seedCatalog } from "./seed.js";
import { slugify, sanitizeCatalog, publicCatalog } from "./catalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const PORT = process.env.PORT || 8080;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "elegance2026";

const DATA_DIR = path.join(ROOT, "data");
const CATALOG_FILE = path.join(DATA_DIR, "catalog.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const DIST_DIR = path.join(ROOT, "dist");

for (const dir of [DATA_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readCatalog() {
  try {
    return JSON.parse(fs.readFileSync(CATALOG_FILE, "utf-8"));
  } catch {
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(seedCatalog, null, 2));
    return JSON.parse(JSON.stringify(seedCatalog));
  }
}

function writeCatalog(catalog) {
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2));
}

const app = express();
app.use(express.json({ limit: "2mb" }));

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || ".jpg").toLowerCase();
    const base = slugify(path.basename(file.originalname, ext)).slice(0, 40) || "img";
    cb(null, `${Date.now()}-${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype);
    cb(ok ? null : new Error("Formato de imagen no soportado"), ok);
  }
});

app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "7d" }));

app.get("/api/catalog", (req, res) => {
  res.json(publicCatalog(readCatalog()));
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }
  res.json({ token: ADMIN_PASSWORD });
});

app.get("/api/admin/catalog", requireAuth, (req, res) => {
  res.json(sanitizeCatalog(readCatalog()));
});

app.put("/api/admin/catalog", requireAuth, (req, res) => {
  const clean = sanitizeCatalog(req.body);
  writeCatalog(clean);
  res.json({ ok: true, catalog: clean });
});

app.post("/api/admin/upload", requireAuth, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No se recibió ninguna imagen" });
    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(DIST_DIR, "admin.html"));
});

app.use(express.static(DIST_DIR));

app.get("*", (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Élégance corriendo en http://localhost:${PORT}`);
  console.log(`Panel admin: http://localhost:${PORT}/admin  (contraseña: ${ADMIN_PASSWORD})`);
});
