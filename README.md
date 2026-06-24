# Élégance — Tienda de belleza

Tienda web estática con carrusel de productos, carrito, vista rápida y panel de administración. Los datos (catálogo e imágenes) se guardan en **Cloudflare KV** y la API corre en un **Cloudflare Worker**. El frontend puede publicarse en **Vercel** o servirse desde el mismo Worker.

## Características

- **Tienda pública**: slider animado, carrusel de productos, carrito, quick-view al hacer clic o hover
- **Búsqueda** de productos por nombre y descripción
- **Filtro por categorías** (pestañas cuando hay 2 o más categorías)
- **Panel de administración** (`/admin`): categorías, subcategorías, productos, datos de la tienda, subida de imágenes
- **Persistencia** en Cloudflare KV (catálogo JSON + imágenes)

## Arquitectura

```
┌─────────────────────┐         ┌──────────────────────────────────┐
│  Vercel (opcional)  │  CORS   │  Cloudflare Worker               │
│  dist/ (estático)   │ ──────► │  /api/*  → catálogo y admin      │
│  config.js → apiBase│         │  /img/*  → imágenes en KV         │
└─────────────────────┘         │  CATALOG_KV → datos persistentes │
                                └──────────────────────────────────┘
```

| Componente | Rol |
|------------|-----|
| `dist/` | HTML, CSS y JS del sitio y del admin |
| `worker/index.js` | API REST, imágenes y assets (si desplegás todo en Cloudflare) |
| `server/` | Servidor Express para desarrollo local sin Wrangler |
| Cloudflare KV | Catálogo (`catalog`) e imágenes (`img:*`) |

## Estructura del proyecto

```
├── dist/                 # Frontend (tienda + admin)
│   ├── index.html
│   ├── script.js
│   ├── style.css
│   ├── admin.html
│   ├── admin.js
│   ├── admin.css
│   └── config.js         # URL del Worker cuando el front está en otro dominio
├── worker/
│   └── index.js          # Worker de Cloudflare (API + assets)
├── server/
│   ├── index.js          # Servidor Node/Express (desarrollo local)
│   ├── catalog.js        # Sanitización y migración del catálogo
│   └── seed.js           # Datos iniciales
├── wrangler.toml         # Configuración del Worker y KV
├── vercel.json           # Despliegue estático en Vercel
└── package.json
```

## Requisitos

- [Node.js](https://nodejs.org/) 18+
- Cuenta de [Cloudflare](https://dash.cloudflare.com/) (Worker + KV)
- (Opcional) Cuenta de [Vercel](https://vercel.com/) para el frontend

## Instalación

```bash
git clone <url-del-repo>
cd tiendaProductoCosmetologia
npm install
```

## Desarrollo local

### Opción A — Node + Express (más simple)

1. Copiá las variables de entorno:

   ```bash
   cp .env.example .env
   ```

2. Editá `.env` si querés cambiar la contraseña del admin o el puerto.

3. Iniciá el servidor:

   ```bash
   npm run dev
   ```

4. Abrí:
   - Tienda: http://localhost:8080
   - Admin: http://localhost:8080/admin

Los datos se guardan en `data/catalog.json` e imágenes en `data/uploads/`.

En este modo, dejá `apiBase: ""` en `dist/config.js`.

### Opción B — Wrangler (igual que producción)

1. Creá `.dev.vars` con la contraseña del admin:

   ```
   ADMIN_PASSWORD=tu_contraseña
   ```

2. Iniciá el Worker en local:

   ```bash
   npm run cf:dev
   ```

3. Abrí la URL que muestra Wrangler (por defecto suele ser `http://localhost:8787`).

## Despliegue en producción

### 1. Cloudflare Worker (API + KV)

```bash
npx wrangler login
npm run cf:secret    # define ADMIN_PASSWORD en Cloudflare
npm run cf:deploy
```

Anotá la URL del Worker, por ejemplo:

`https://elegance-estetica.tu-usuario.workers.dev`

### 2. Frontend en Vercel

1. En `dist/config.js`, configurá la URL del Worker:

   ```js
   window.ELEGANCE_CONFIG = {
     apiBase: "https://elegance-estetica.tu-usuario.workers.dev"
   };
   ```

2. Conectá el repositorio en Vercel o desplegá desde la CLI:

   ```bash
   npx vercel --prod
   ```

   `vercel.json` ya apunta a la carpeta `dist/` como sitio estático.

### 3. Todo en Cloudflare (sin Vercel)

Si solo usás `wrangler deploy`, el Worker sirve `dist/` y la API en el mismo dominio. En ese caso:

```js
window.ELEGANCE_CONFIG = { apiBase: "" };
```

## Panel de administración

- **URL**: `/admin` (en Vercel: `https://tu-proyecto.vercel.app/admin`)
- **Contraseña**: la definida en `ADMIN_PASSWORD` (Worker) o en `.env` (Node local)

Desde el panel podés:

- Editar nombre de la tienda y WhatsApp
- Crear categorías y subcategorías
- Agregar, editar y ocultar productos
- Subir fotos (se guardan en KV vía `/api/admin/upload`)

## API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/catalog` | No | Catálogo público (solo disponibles) |
| `POST` | `/api/admin/login` | No | Login (`{ "password": "..." }`) |
| `GET` | `/api/admin/catalog` | Bearer | Catálogo completo para el admin |
| `PUT` | `/api/admin/catalog` | Bearer | Guardar catálogo |
| `POST` | `/api/admin/upload` | Bearer | Subir imagen (`multipart`, campo `image`) |
| `GET` | `/img/:nombre` | No | Imagen almacenada en KV |

## Variables de entorno

| Variable | Dónde | Uso |
|----------|--------|-----|
| `ADMIN_PASSWORD` | `.env` / `.dev.vars` / `wrangler secret` | Contraseña del panel admin |
| `PORT` | `.env` | Puerto del servidor Node (default `8080`) |

## Scripts npm

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor local Express |
| `npm start` | Igual que `dev` |
| `npm run cf:dev` | Worker en local con Wrangler |
| `npm run cf:deploy` | Publicar Worker en Cloudflare |
| `npm run cf:secret` | Configurar `ADMIN_PASSWORD` en Cloudflare |

## Modelo del catálogo

El catálogo se guarda en KV con esta estructura:

```json
{
  "site": {
    "storeName": "Élégance",
    "tagline": "Belleza Premium",
    "whatsappNumber": ""
  },
  "categories": [
    {
      "id": "productos",
      "label": "Productos",
      "emoji": "💄",
      "enabled": true,
      "order": 1,
      "products": [
        {
          "id": "p1",
          "name": "Serum Facial",
          "price": 18500,
          "description": "...",
          "code": "",
          "available": true,
          "image": "/img/..."
        }
      ]
    }
  ]
}
```

Si en KV quedó un catálogo antiguo con `products` plano (sin `categories`), el Worker lo migra automáticamente a una categoría **Productos** al leerlo.

## Notas

- No subas `.env`, `.dev.vars` ni `data/` al repositorio (ya están en `.gitignore`).
- Tras cambiar `dist/config.js`, volvé a desplegar en Vercel.
- El filtro de categorías en la tienda solo muestra pestañas cuando hay **2 o más categorías** en el catálogo.

## Licencia

Proyecto privado.
