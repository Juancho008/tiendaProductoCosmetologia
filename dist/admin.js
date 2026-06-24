const TOKEN_KEY = 'elegance_admin_token'
const root = document.getElementById('admin-root')

let token = sessionStorage.getItem(TOKEN_KEY) || ''
let catalog = { store: { name: '', tagline: '' }, products: [] }
let messageTimer = null

const peso = (n) => '$' + Number(n || 0).toLocaleString('es-CL')

const API_BASE = (window.ELEGANCE_CONFIG && window.ELEGANCE_CONFIG.apiBase) || ''
const apiUrl = (path) => `${API_BASE}${path}`
const resolveImg = (url) =>
  url && url.startsWith('/') ? `${API_BASE}${url}` : url

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function authHeaders(extra = {}) {
  return { Authorization: 'Bearer ' + token, ...extra }
}

function showMessage(text, isError = false) {
  let el = document.querySelector('.admin-message')
  if (!el) {
    el = document.createElement('div')
    el.className = 'admin-message'
    document.body.appendChild(el)
  }
  el.textContent = text
  el.classList.toggle('is-error', isError)
  el.classList.add('is-visible')
  clearTimeout(messageTimer)
  messageTimer = setTimeout(() => el.classList.remove('is-visible'), 3000)
}

async function login(password) {
  const r = await fetch(apiUrl('/api/admin/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    throw new Error(data.error || 'No se pudo ingresar')
  }
  const data = await r.json()
  token = data.token
  sessionStorage.setItem(TOKEN_KEY, token)
}

function logout() {
  sessionStorage.removeItem(TOKEN_KEY)
  token = ''
  renderLogin()
}

async function loadCatalog() {
  const r = await fetch(apiUrl('/api/admin/catalog'), { headers: authHeaders() })
  if (r.status === 401) {
    logout()
    throw new Error('Sesión expirada')
  }
  if (!r.ok) throw new Error('No se pudo cargar el catálogo')
  const data = await r.json()
  catalog = {
    store: { name: data.store?.name || '', tagline: data.store?.tagline || '' },
    products: Array.isArray(data.products) ? data.products : []
  }
}

async function saveCatalog() {
  const r = await fetch(apiUrl('/api/admin/catalog'), {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(catalog)
  })
  if (r.status === 401) {
    logout()
    return
  }
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    showMessage(data.error || 'No se pudo guardar', true)
    return
  }
  catalog = data.catalog
  renderList()
  showMessage('Cambios guardados. Recargá la tienda para verlos.')
}

async function uploadImage(idx, file) {
  const form = new FormData()
  form.append('image', file)
  const r = await fetch(apiUrl('/api/admin/upload'), {
    method: 'POST',
    headers: authHeaders(),
    body: form
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    showMessage(data.error || 'No se pudo subir la imagen', true)
    return
  }
  catalog.products[idx].image = data.url
  const row = root.querySelector(`.product-row[data-idx="${idx}"]`)
  if (row) {
    row.querySelector('.product-thumb img').src = data.url
    const hidden = row.querySelector('input[data-field="image"]')
    if (hidden) hidden.value = data.url
  }
  showMessage('Imagen subida')
}

function emptyProduct() {
  return {
    id: 'new-' + Date.now(),
    name: '',
    price: 0,
    category: '',
    available: true,
    image: '',
    description: ''
  }
}

function renderLogin() {
  root.innerHTML = `
    <div class="login-screen">
      <form class="login-card" id="login-form">
        <h1 class="login-brand">Élégance</h1>
        <p class="login-sub">Panel de administración</p>
        <label>
          Contraseña
          <input type="password" id="login-password" placeholder="Contraseña de admin" autocomplete="current-password" />
        </label>
        <p class="login-error" id="login-error" style="display:none"></p>
        <button type="submit" class="btn btn-primary">Ingresar</button>
        <a href="/" class="login-sub" style="text-decoration:none">← Volver a la tienda</a>
      </form>
    </div>`

  const form = document.getElementById('login-form')
  const errEl = document.getElementById('login-error')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    errEl.style.display = 'none'
    const pwd = document.getElementById('login-password').value
    try {
      await login(pwd)
      await loadCatalog()
      renderEditor()
    } catch (err) {
      errEl.textContent = err.message
      errEl.style.display = 'block'
    }
  })
}

function productRowHTML(p, idx) {
  const image = resolveImg(p.image) || ''
  const thumb = image || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%231e0a0e"/></svg>')
  return `
  <div class="product-row" data-idx="${idx}">
    <div class="product-thumb">
      <img src="${escapeHtml(thumb)}" alt="">
      <label class="upload-label">
        Subir foto
        <input type="file" accept="image/*" data-action="upload" data-idx="${idx}">
      </label>
    </div>
    <div class="product-fields">
      <label class="full">Nombre
        <input type="text" data-idx="${idx}" data-field="name" value="${escapeHtml(p.name)}" placeholder="Nombre del producto">
      </label>
      <label>Precio
        <input type="number" min="0" step="1" data-idx="${idx}" data-field="price" value="${escapeHtml(p.price)}">
      </label>
      <label>Categoría
        <input type="text" data-idx="${idx}" data-field="category" value="${escapeHtml(p.category)}" placeholder="Skincare, Maquillaje…">
      </label>
      <label class="check">
        <input type="checkbox" data-idx="${idx}" data-field="available" ${p.available !== false ? 'checked' : ''}>
        Disponible
      </label>
      <label class="full">Descripción
        <textarea data-idx="${idx}" data-field="description" placeholder="Descripción del producto">${escapeHtml(p.description)}</textarea>
      </label>
      <input type="hidden" data-idx="${idx}" data-field="image" value="${escapeHtml(image)}">
      <div class="product-foot">
        <span style="color:var(--muted);font-size:0.72rem">${peso(p.price)}</span>
        <button type="button" class="btn btn-danger btn-sm" data-action="remove" data-idx="${idx}">Eliminar</button>
      </div>
    </div>
  </div>`
}

function renderList() {
  const list = document.getElementById('product-list')
  if (!list) return
  list.innerHTML = catalog.products.map(productRowHTML).join('')
  const countEl = document.getElementById('product-count')
  if (countEl) countEl.textContent = `${catalog.products.length} producto(s)`
}

function renderEditor() {
  root.innerHTML = `
    <header class="admin-header">
      <h1>Élégance · Admin</h1>
      <div class="admin-actions">
        <a class="btn btn-ghost btn-sm" href="/" target="_blank" rel="noreferrer">Ver tienda</a>
        <button type="button" class="btn btn-ghost btn-sm" data-action="logout">Salir</button>
        <button type="button" class="btn btn-primary btn-sm" data-action="save">Guardar</button>
      </div>
    </header>

    <main class="admin-main">
      <section class="card">
        <h2>Datos de la tienda</h2>
        <div class="grid-2">
          <label>Nombre
            <input type="text" data-store="name" value="${escapeHtml(catalog.store.name)}">
          </label>
          <label>Eslogan
            <input type="text" data-store="tagline" value="${escapeHtml(catalog.store.tagline)}">
          </label>
        </div>
      </section>

      <section class="card">
        <div class="products-head">
          <h2>Productos</h2>
          <button type="button" class="btn btn-sm" data-action="add">+ Agregar producto</button>
        </div>
        <div id="product-list"></div>
      </section>
    </main>

    <div class="savebar">
      <span id="product-count"></span>
      <button type="button" class="btn btn-primary" data-action="save">Guardar cambios</button>
    </div>`

  renderList()
  bindEditor()
}

function bindEditor() {
  root.addEventListener('input', (e) => {
    const t = e.target
    if (t.dataset.store) {
      catalog.store[t.dataset.store] = t.value
      return
    }
    const idx = t.dataset.idx
    const field = t.dataset.field
    if (idx == null || !field || field === 'available') return
    const product = catalog.products[Number(idx)]
    if (!product) return
    if (field === 'price') {
      product.price = Number(t.value) || 0
      const foot = root.querySelector(`.product-row[data-idx="${idx}"] .product-foot span`)
      if (foot) foot.textContent = peso(product.price)
    } else {
      product[field] = t.value
    }
  })

  root.addEventListener('change', (e) => {
    const t = e.target
    const idx = Number(t.dataset.idx)
    if (t.dataset.field === 'available') {
      if (catalog.products[idx]) catalog.products[idx].available = t.checked
      return
    }
    if (t.dataset.action === 'upload' && t.files && t.files[0]) {
      uploadImage(idx, t.files[0])
      t.value = ''
    }
  })

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]')
    if (!btn) return
    const action = btn.dataset.action

    if (action === 'logout') logout()
    else if (action === 'save') saveCatalog()
    else if (action === 'add') {
      catalog.products.push(emptyProduct())
      renderList()
    } else if (action === 'remove') {
      const idx = Number(btn.dataset.idx)
      catalog.products.splice(idx, 1)
      renderList()
    }
  })
}

async function init() {
  if (!token) {
    renderLogin()
    return
  }
  try {
    await loadCatalog()
    renderEditor()
  } catch {
    renderLogin()
  }
}

init()
