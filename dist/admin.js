const TOKEN_KEY = 'elegance_admin_token'
const root = document.getElementById('admin-root')

let token = sessionStorage.getItem(TOKEN_KEY) || ''
let state = null // { site, groups: [{ id, label, subcategories: [{ id, label, emoji, enabled, products }] }] }
let expanded = new Set(['site'])
let activeNav = 'site'
let adminTab = 'catalogo'
let pendingScroll = null
let loading = false
let messageTimer = null

const API_BASE = (window.ELEGANCE_CONFIG && window.ELEGANCE_CONFIG.apiBase) || ''
const apiUrl = (path) => `${API_BASE}${path}`
const resolveImg = (url) =>
  url && url.startsWith('/') ? `${API_BASE}${url}` : url

const peso = (n) => '$' + Number(n || 0).toLocaleString('es-CL')

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
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
  messageTimer = setTimeout(() => el.classList.remove('is-visible'), 3500)
}

// ---------- Conversión catálogo plano <-> grupos ----------

function catalogToGroups(catalog) {
  const groupsMap = new Map()
  for (const cat of catalog?.categories || []) {
    const clone = JSON.parse(JSON.stringify(cat))
    if (cat.group) {
      const parentId = cat.groupId || slugify(cat.group)
      if (!groupsMap.has(parentId)) {
        groupsMap.set(parentId, { id: parentId, label: cat.group, subcategories: [] })
      }
      groupsMap.get(parentId).subcategories.push(clone)
      continue
    }

    const id = cat.groupId || slugify(cat.label) || cat.id
    groupsMap.set(id + '::' + cat.id, {
      id,
      label: cat.label,
      subcategories: [clone]
    })
  }
  return {
    site: JSON.parse(JSON.stringify(catalog?.site || {})),
    groups: [...groupsMap.values()]
  }
}

function groupsToCatalog(editorState) {
  const categories = []
  let order = 1
  for (const group of editorState.groups || []) {
    const multiSub = group.subcategories.length > 1
    for (const sub of group.subcategories || []) {
      const subId = sub.id || slugify(sub.label)
      categories.push({
        id: subId,
        label: sub.label || 'Sin nombre',
        emoji: sub.emoji || '✨',
        group: multiSub ? group.label : undefined,
        groupId: multiSub ? group.id : undefined,
        enabled: sub.enabled !== false,
        order: order++,
        products: (sub.products || []).map((p) => ({
          ...p,
          id: p.id || `${subId}/${p.code || slugify(p.name)}`,
          category: subId
        }))
      })
    }
  }
  return {
    site: editorState.site || {},
    categories
  }
}

function emptyProduct(subId) {
  const code = String(Date.now()).slice(-4)
  return {
    id: `${subId}/nuevo-${code}`,
    name: '',
    price: 0,
    description: '',
    code: '',
    available: true,
    image: '',
    category: subId
  }
}

function emptySubcategory(groupId) {
  const id = `${groupId || 'cat'}-sub-${String(Date.now()).slice(-5)}`
  return {
    id,
    label: 'Nueva subcategoría',
    emoji: '✨',
    enabled: true,
    products: []
  }
}

function emptyGroup() {
  const id = slugify('grupo-' + Date.now())
  return { id, label: 'Nueva categoría', subcategories: [emptySubcategory(id)] }
}

// ---------- API ----------

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
  state = null
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
  state = catalogToGroups(data)
}

async function saveCatalog() {
  if (loading) return
  loading = true
  renderEditor()
  try {
    const payload = groupsToCatalog(state)
    const r = await fetch(apiUrl('/api/admin/catalog'), {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    })
    if (r.status === 401) {
      logout()
      return
    }
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.error || 'No se pudo guardar')
    state = catalogToGroups(data.catalog)
    showMessage('Cambios guardados en Cloudflare. Recargá la tienda para verlos.')
  } catch (err) {
    showMessage(err.message, true)
  } finally {
    loading = false
    renderEditor()
  }
}

async function uploadImage(gi, si, pi, file) {
  const sub = state.groups[gi]?.subcategories[si]
  const product = sub?.products[pi]
  if (!product) return
  const form = new FormData()
  form.append('image', file)
  showMessage('Subiendo imagen…')
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
  product.image = data.url
  showMessage('Imagen subida')
  renderEditor()
}

async function uploadHeroImage(index, file) {
  state.site = state.site || {}
  if (!Array.isArray(state.site.heroImages)) state.site.heroImages = []
  const form = new FormData()
  form.append('image', file)
  showMessage('Subiendo imagen…')
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
  state.site.heroImages[index] = data.url
  showMessage('Imagen de portada actualizada')
  renderEditor()
}

async function uploadClientImage(ci, file) {
  const client = state.site?.clients?.[ci]
  if (!client) return
  const form = new FormData()
  form.append('image', file)
  showMessage('Subiendo imagen…')
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
  client.image = data.url
  showMessage('Foto del cliente actualizada')
  renderEditor()
}

// ---------- IDs de sección ----------

function sectionId(gi, si) {
  if (gi === undefined) return 'site'
  if (si === undefined) return `g-${gi}`
  return `g-${gi}-s-${si}`
}

function isOpen(id) {
  return expanded.has(id)
}

// ---------- Render ----------

function renderLogin() {
  root.innerHTML = `
    <div class="login-screen">
      <form class="login-card" id="login-form">
        <h1 class="login-brand">Beauty</h1>
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

function totalProducts() {
  return state.groups.reduce(
    (n, g) => n + g.subcategories.reduce((m, s) => m + s.products.length, 0),
    0
  )
}

function navHTML() {
  const items = [
    `<li><button type="button" class="nav-btn depth-0${activeNav === 'site' ? ' active' : ''}" data-action="nav" data-id="site">
      <span class="nav-emoji">🏪</span><span class="nav-label">Datos de tienda</span></button></li>`
  ]
  state.groups.forEach((group, gi) => {
    const gid = sectionId(gi)
    const visible = group.subcategories.some((s) => s.enabled !== false)
    items.push(`<li><button type="button" class="nav-btn depth-0${activeNav === gid ? ' active' : ''}${visible ? '' : ' is-hidden-cat'}" data-action="nav" data-id="${gid}">
      <span class="nav-emoji">📁</span><span class="nav-label">${escapeHtml(group.label)}</span></button></li>`)
    group.subcategories.forEach((sub, si) => {
      const sid = sectionId(gi, si)
      const subVisible = sub.enabled !== false
      items.push(`<li><button type="button" class="nav-btn depth-1${activeNav === sid ? ' active' : ''}${subVisible ? '' : ' is-hidden-cat'}" data-action="nav" data-id="${sid}">
        <span class="nav-emoji">${escapeHtml(sub.emoji || '✨')}</span><span class="nav-label">${escapeHtml(sub.label)}</span><span class="nav-count">${sub.products.length}</span></button></li>`)
    })
  })
  return items.join('')
}

function productRowHTML(product, gi, si, pi) {
  const image = resolveImg(product.image) || ''
  const thumb = image || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="%231e0a0e"/></svg>')
  return `
  <div class="product-row" data-gi="${gi}" data-si="${si}" data-pi="${pi}">
    <div class="product-media">
      <img src="${escapeHtml(thumb)}" alt="">
      <label class="image-upload">📷 Cambiar foto
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-action="upload" data-gi="${gi}" data-si="${si}" data-pi="${pi}">
      </label>
    </div>
    <div class="product-fields">
      <label class="f-name">Nombre
        <input type="text" value="${escapeHtml(product.name)}" data-kind="product" data-gi="${gi}" data-si="${si}" data-pi="${pi}" data-field="name" placeholder="Ej: Serum facial">
      </label>
      <div class="product-fields-row">
        <label class="f-price">Precio
          <input type="number" min="0" step="1" inputmode="numeric" value="${escapeHtml(product.price ?? 0)}" data-kind="product" data-gi="${gi}" data-si="${si}" data-pi="${pi}" data-field="price" placeholder="0">
        </label>
        <label class="f-code">Código <span class="label-hint">(opcional)</span>
          <input type="text" value="${escapeHtml(product.code || '')}" data-kind="product" data-gi="${gi}" data-si="${si}" data-pi="${pi}" data-field="code" placeholder="—">
        </label>
      </div>
      <label class="f-desc">Descripción
        <textarea data-kind="product" data-gi="${gi}" data-si="${si}" data-pi="${pi}" data-field="description" placeholder="Breve descripción del producto">${escapeHtml(product.description || '')}</textarea>
      </label>
    </div>
    <div class="product-row-actions">
      <label class="f-check">
        <input type="checkbox" ${product.available !== false ? 'checked' : ''} data-action="toggle-available" data-gi="${gi}" data-si="${si}" data-pi="${pi}">
        Disponible
      </label>
      <button type="button" class="btn-remove" data-action="remove-product" data-gi="${gi}" data-si="${si}" data-pi="${pi}" aria-label="Eliminar producto">Eliminar</button>
    </div>
  </div>`
}

function subcategoryHTML(sub, gi, si, canRemove) {
  const sid = sectionId(gi, si)
  const open = isOpen(sid)
  const visible = sub.enabled !== false
  const body = !open ? '' : `
    <div class="section-body">
      <div class="sub-head">
        <label>Subcategoría
          <input type="text" value="${escapeHtml(sub.label)}" data-kind="sub" data-gi="${gi}" data-si="${si}" data-field="label" placeholder="Ej: Skincare, Maquillaje">
        </label>
        <label class="emoji-field">Emoji
          <input type="text" maxlength="4" value="${escapeHtml(sub.emoji || '✨')}" data-kind="sub" data-gi="${gi}" data-si="${si}" data-field="emoji">
        </label>
        <button type="button" class="btn-toggle${visible ? '' : ' off'}" data-action="toggle-sub" data-gi="${gi}" data-si="${si}">${visible ? '👁 Visible' : '🚫 Oculta'}</button>
        ${canRemove ? `<button type="button" class="btn btn-ghost btn-sm" data-action="remove-sub" data-gi="${gi}" data-si="${si}">Quitar</button>` : ''}
      </div>
      <div class="products">
        <div class="products-head">
          <span>Productos</span>
          <button type="button" class="btn btn-sm" data-action="add-product" data-gi="${gi}" data-si="${si}">+ Agregar</button>
        </div>
        ${sub.products.length === 0
          ? '<p class="hint">Sin productos.</p>'
          : `<div class="product-list">${sub.products.map((p, pi) => productRowHTML(p, gi, si, pi)).join('')}</div>`}
      </div>
    </div>`

  return `
  <div class="subcategory section${visible ? '' : ' section-off'}${open ? ' is-open' : ''}" id="editor-${sid}">
    <button type="button" class="sub-toggle" data-action="toggle-section" data-id="${sid}" aria-expanded="${open}">
      <span>${escapeHtml(sub.emoji || '✨')} ${escapeHtml(sub.label)} <small>${sub.products.length} producto(s)</small></span>
      <span class="sub-meta">${visible ? '' : '<span class="badge">Oculta</span>'}<span class="chevron">${open ? '▼' : '▶'}</span></span>
    </button>
    ${body}
  </div>`
}

function groupHTML(group, gi) {
  const gid = sectionId(gi)
  const open = isOpen(gid)
  const visible = group.subcategories.some((s) => s.enabled !== false)
  const canRemoveSub = group.subcategories.length > 1
  const body = !open ? '' : `
    <div class="section-body">
      <div class="group-head">
        <label class="group-label">Categoría principal
          <input type="text" value="${escapeHtml(group.label)}" data-kind="group" data-gi="${gi}" data-field="label" placeholder="Ej: Skincare">
        </label>
        <button type="button" class="btn-toggle${visible ? '' : ' off'}" data-action="toggle-group" data-gi="${gi}">${visible ? '👁 Visible' : '🚫 Oculta'}</button>
        <button type="button" class="btn btn-danger btn-sm" data-action="remove-group" data-gi="${gi}">Eliminar</button>
      </div>
      ${group.subcategories.map((sub, si) => subcategoryHTML(sub, gi, si, canRemoveSub)).join('')}
      <button type="button" class="btn btn-secondary btn-sm" data-action="add-sub" data-gi="${gi}">+ Agregar subcategoría</button>
    </div>`

  return `
  <section class="card group-card section${visible ? '' : ' section-off'}${open ? ' is-open' : ''}" id="editor-${gid}">
    <button type="button" class="section-toggle" data-action="toggle-section" data-id="${gid}" aria-expanded="${open}">
      <span>📁 ${escapeHtml(group.label)} <small>${group.subcategories.length} subcategoría(s)</small></span>
      <span class="chevron">${open ? '▼' : '▶'}</span>
    </button>
    ${body}
  </section>`
}

function heroSlotHTML(label, index, url) {
  const image = resolveImg(url) || ''
  const thumb = image || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="80" height="120" fill="%231e0a0e"/></svg>')
  return `
  <div class="hero-slot">
    <img src="${escapeHtml(thumb)}" alt="">
    <div class="hero-slot-info">
      <span class="hero-slot-label">${label}</span>
      <label class="image-upload">📷 Cambiar
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-action="upload-hero" data-hero-index="${index}">
      </label>
    </div>
  </div>`
}

function siteSectionHTML() {
  const open = isOpen('site')
  const site = state.site || {}
  const hero = Array.isArray(site.heroImages) ? site.heroImages : []
  const heroLabels = ['Portada 1 · izquierda', 'Portada 1 · derecha', 'Portada 2 · izquierda', 'Portada 2 · derecha']
  const slides = Array.isArray(site.slides) ? site.slides : []
  const sideText = site.sideText || {}
  const slideTitles = ['Portada 1', 'Portada 2']
  const slidesHTML = slideTitles.map((title, si) => {
    const lines = slides[si]?.lines || []
    const inputs = [0, 1, 2, 3].map((li) =>
      `<input type="text" value="${escapeHtml(lines[li] || '')}" data-slide="${si}" data-line="${li}" placeholder="Línea ${li + 1}">`
    ).join('')
    return `
    <div class="text-slot">
      <span class="text-slot-label">${title}</span>
      <div class="text-lines">${inputs}</div>
    </div>`
  }).join('')
  const body = !open ? '' : `
    <div class="section-body">
      <div class="grid-2">
        <label>Nombre de la tienda
          <input type="text" value="${escapeHtml(site.storeName || '')}" data-site="storeName">
        </label>
        <label>WhatsApp (sin + ni espacios)
          <input type="text" value="${escapeHtml(site.whatsappNumber || '')}" data-site="whatsappNumber" placeholder="549...">
        </label>
      </div>
      <div class="hero-block">
        <div class="hero-block-head">
          <span class="hero-block-title">🖼️ Imágenes de portada</span>
          <span class="hero-block-hint">Tamaño recomendado: 800 × 1200 px (vertical)</span>
        </div>
        <div class="hero-grid">
          ${heroLabels.map((label, i) => heroSlotHTML(label, i, hero[i])).join('')}
        </div>
      </div>
      <div class="hero-block">
        <div class="hero-block-head">
          <span class="hero-block-title">✍️ Textos de portada</span>
          <span class="hero-block-hint">Encerrá una palabra entre *asteriscos* para resaltarla en dorado</span>
        </div>
        <div class="text-grid">
          ${slidesHTML}
        </div>
      </div>
      <div class="hero-block">
        <div class="hero-block-head">
          <span class="hero-block-title">📐 Texto lateral</span>
        </div>
        <div class="grid-2">
          <label>Título
            <input type="text" value="${escapeHtml(sideText.title || '')}" data-sidetext="title" placeholder="Beauty">
          </label>
          <label>Subtítulo <span class="label-hint">(opcional)</span>
            <input type="text" value="${escapeHtml(sideText.subtitle || '')}" data-sidetext="subtitle" placeholder="Colección Bordó">
          </label>
        </div>
      </div>
    </div>`
  return `
  <section class="card section${open ? ' is-open' : ''}" id="editor-site">
    <button type="button" class="section-toggle" data-action="toggle-section" data-id="site" aria-expanded="${open}">
      <span>🏪 Datos de la tienda</span>
      <span class="chevron">${open ? '▼' : '▶'}</span>
    </button>
    ${body}
  </section>`
}

function clientCardHTML(client, ci) {
  const image = resolveImg(client.image) || ''
  const thumb = image || 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="%231e0a0e"/></svg>')
  return `
  <div class="client-card-edit" data-ci="${ci}">
    <label class="client-photo">
      <img src="${escapeHtml(thumb)}" alt="">
      <span class="client-photo__btn">📷 Cambiar foto</span>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-action="upload-client" data-ci="${ci}">
    </label>
    <div class="client-card-edit__fields">
      <label>Nombre
        <input type="text" value="${escapeHtml(client.name || '')}" data-client="${ci}" data-cfield="name" placeholder="Ej: María González">
      </label>
      <label>Comentario
        <textarea data-client="${ci}" data-cfield="comment" placeholder="Opinión del cliente">${escapeHtml(client.comment || '')}</textarea>
      </label>
    </div>
    <button type="button" class="btn-remove client-card-edit__remove" data-action="remove-client" data-ci="${ci}" aria-label="Eliminar cliente">Eliminar</button>
  </div>`
}

function clientsCount() {
  return Array.isArray(state.site?.clients) ? state.site.clients.length : 0
}

function clientsPanelHTML() {
  const clients = Array.isArray(state.site?.clients) ? state.site.clients : []
  const list = clients.length
    ? clients.map((c, i) => clientCardHTML(c, i)).join('')
    : '<p class="empty-hint">Todavía no hay clientes. Agregá el primero.</p>'
  const site = state.site || {}
  return `
  <section class="card section is-open" id="editor-clients">
    <div class="section-body">
      <div class="grid-2">
        <label>Valoración <span class="label-hint">(ej: 4.9)</span>
          <input type="text" inputmode="decimal" value="${escapeHtml(site.clientsRating ?? '4.9')}" data-site="clientsRating" placeholder="4.9">
        </label>
        <label>Estrellas llenas <span class="label-hint">(0 a 5)</span>
          <input type="number" min="0" max="5" step="1" value="${escapeHtml(site.clientsStars ?? 5)}" data-site="clientsStars" placeholder="5">
        </label>
      </div>
      <p class="section-hint">Testimonios que se muestran en la pestaña “Clientes” de la tienda. La foto se muestra como retrato vertical (recomendado 800 × 1000 px). Es opcional: si no cargás una, se muestran las iniciales.</p>
      <div class="clients-list">
        ${list}
      </div>
      <button type="button" class="btn btn-secondary btn-sm" data-action="add-client">+ Agregar cliente</button>
    </div>
  </section>`
}

function renderEditor() {
  if (!state) return
  const saveLabel = loading ? 'Guardando…' : 'Guardar cambios'
  const isClients = adminTab === 'clientes'

  const tabs = `
    <div class="admin-tabs">
      <button type="button" class="admin-tab${isClients ? '' : ' is-active'}" data-action="admin-tab" data-tab="catalogo">🛍️ Productos</button>
      <button type="button" class="admin-tab${isClients ? ' is-active' : ''}" data-action="admin-tab" data-tab="clientes">💬 Clientes</button>
    </div>`

  const toolbar = isClients
    ? `
    <div class="editor-toolbar">
      <div class="toolbar-info">
        <strong>Clientes</strong>
        <span>${clientsCount()} testimonio(s)</span>
      </div>
      <div class="toolbar-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-action="add-client">+ Cliente</button>
        <button type="button" class="btn btn-primary btn-sm" data-action="save" ${loading ? 'disabled' : ''}>${saveLabel}</button>
      </div>
    </div>`
    : `
    <div class="editor-toolbar">
      <div class="toolbar-info">
        <strong>Editor de catálogo</strong>
        <span>${state.groups.length} categoría(s) · ${totalProducts()} producto(s)</span>
      </div>
      <div class="toolbar-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-action="expand-all">Expandir todo</button>
        <button type="button" class="btn btn-ghost btn-sm" data-action="collapse-all">Colapsar</button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="add-group">+ Categoría</button>
        <button type="button" class="btn btn-primary btn-sm" data-action="save" ${loading ? 'disabled' : ''}>${saveLabel}</button>
      </div>
    </div>`

  const body = isClients
    ? `
    <div class="editor-body editor-body--full">
      <div class="editor-main">
        ${clientsPanelHTML()}
      </div>
    </div>`
    : `
    <div class="editor-body">
      <nav class="editor-nav" aria-label="Secciones del catálogo">
        <p class="nav-title">Ir a…</p>
        <ul>${navHTML()}</ul>
      </nav>
      <div class="editor-main">
        ${siteSectionHTML()}
        ${state.groups.map((g, gi) => groupHTML(g, gi)).join('')}
      </div>
    </div>`

  const savebar = isClients
    ? `
    <div class="savebar">
      <span>${clientsCount()} testimonio(s)</span>
      <button type="button" class="btn btn-primary" data-action="save" ${loading ? 'disabled' : ''}>${saveLabel}</button>
    </div>`
    : `
    <div class="savebar">
      <span>${totalProducts()} productos en el catálogo</span>
      <button type="button" class="btn btn-primary" data-action="save" ${loading ? 'disabled' : ''}>${saveLabel}</button>
    </div>`

  root.innerHTML = `
    <header class="admin-header">
      <div>
        <h1>Panel de administración</h1>
        <p>${isClients ? 'Administrá los testimonios de tus clientes' : 'Editá las categorías, subcategorías y productos del catálogo'}</p>
      </div>
      <div class="admin-actions">
        <a class="btn btn-ghost btn-sm" href="/" target="_blank" rel="noreferrer">Ver tienda</a>
        <button type="button" class="btn btn-ghost btn-sm" data-action="logout">Salir</button>
      </div>
    </header>

    ${tabs}
    ${toolbar}
    ${body}
    ${savebar}`

  if (pendingScroll) {
    const el = document.getElementById('editor-' + pendingScroll)
    pendingScroll = null
    if (!el) return
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}

// ---------- Eventos ----------

function handleSiteInput(field, value) {
  state.site = state.site || {}
  state.site[field] = value
}

function handleSlideInput(si, li, value) {
  state.site = state.site || {}
  if (!Array.isArray(state.site.slides)) state.site.slides = []
  if (!state.site.slides[si]) state.site.slides[si] = { lines: [] }
  if (!Array.isArray(state.site.slides[si].lines)) state.site.slides[si].lines = []
  state.site.slides[si].lines[li] = value
}

function handleSideTextInput(field, value) {
  state.site = state.site || {}
  state.site.sideText = state.site.sideText || {}
  state.site.sideText[field] = value
}

function handleProductInput(gi, si, pi, field, value) {
  const product = state.groups[gi]?.subcategories[si]?.products[pi]
  if (!product) return
  product[field] = field === 'price' ? Number(value) || 0 : value
}

function handleEditorInput(t) {
  if (t.dataset.site) {
    handleSiteInput(t.dataset.site, t.value)
    return
  }
  if (t.dataset.slide != null && t.dataset.line != null) {
    handleSlideInput(Number(t.dataset.slide), Number(t.dataset.line), t.value)
    return
  }
  if (t.dataset.sidetext) {
    handleSideTextInput(t.dataset.sidetext, t.value)
    return
  }
  if (t.dataset.client != null && t.dataset.cfield) {
    const client = state.site?.clients?.[Number(t.dataset.client)]
    if (client) client[t.dataset.cfield] = t.value
    return
  }

  const field = t.dataset.field
  if (!t.dataset.kind || !field) return

  const gi = Number(t.dataset.gi)
  const si = Number(t.dataset.si)
  const pi = Number(t.dataset.pi)

  if (t.dataset.kind === 'group') {
    state.groups[gi][field] = t.value
    return
  }
  if (t.dataset.kind === 'sub') {
    state.groups[gi].subcategories[si][field] = t.value
    return
  }
  if (t.dataset.kind === 'product') {
    handleProductInput(gi, si, pi, field, t.value)
  }
}

function handleEditorChange(t) {
  const action = t.dataset.action
  if (action === 'toggle-available') {
    const p = state.groups[Number(t.dataset.gi)]?.subcategories[Number(t.dataset.si)]?.products[Number(t.dataset.pi)]
    if (!p) return
    p.available = t.checked
    return
  }
  if (action === 'upload-hero') {
    if (!t.files?.[0]) return
    uploadHeroImage(Number(t.dataset.heroIndex), t.files[0])
    t.value = ''
    return
  }
  if (action === 'upload-client') {
    if (!t.files?.[0]) return
    uploadClientImage(Number(t.dataset.ci), t.files[0])
    t.value = ''
    return
  }
  if (action !== 'upload' || !t.files?.[0]) return
  uploadImage(Number(t.dataset.gi), Number(t.dataset.si), Number(t.dataset.pi), t.files[0])
  t.value = ''
}

function expandAllSections() {
  const all = new Set(['site'])
  state.groups.forEach((g, i) => {
    all.add(sectionId(i))
    g.subcategories.forEach((_, j) => all.add(sectionId(i, j)))
  })
  expanded = all
  renderEditor()
}

function toggleSection(id) {
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
  renderEditor()
}

function navigateToSection(id) {
  activeNav = id
  expanded.add(id)
  const m = id.match(/^g-(\d+)/)
  if (m) expanded.add(`g-${m[1]}`)
  pendingScroll = id
  renderEditor()
}

function removeGroup(gi) {
  if (!confirm('¿Eliminar esta categoría y todas sus subcategorías?')) return
  state.groups.splice(gi, 1)
  renderEditor()
}

function removeSubcategory(gi, si) {
  if (state.groups[gi].subcategories.length <= 1) return
  state.groups[gi].subcategories.splice(si, 1)
  renderEditor()
}

function handleEditorClick(btn) {
  const action = btn.dataset.action
  const gi = Number(btn.dataset.gi)
  const si = Number(btn.dataset.si)
  const pi = Number(btn.dataset.pi)

  if (action === 'logout') return logout()
  if (action === 'save') return saveCatalog()
  if (action === 'admin-tab') {
    adminTab = btn.dataset.tab === 'clientes' ? 'clientes' : 'catalogo'
    return renderEditor()
  }
  if (action === 'expand-all') return expandAllSections()
  if (action === 'collapse-all') {
    expanded = new Set()
    return renderEditor()
  }
  if (action === 'toggle-section') return toggleSection(btn.dataset.id)
  if (action === 'nav') return navigateToSection(btn.dataset.id)
  if (action === 'add-group') {
    state.groups.push(emptyGroup())
    expanded.add(sectionId(state.groups.length - 1))
    return renderEditor()
  }
  if (action === 'remove-group') return removeGroup(gi)
  if (action === 'toggle-group') {
    const g = state.groups[gi]
    const allEnabled = g.subcategories.every((s) => s.enabled !== false)
    g.subcategories.forEach((s) => { s.enabled = !allEnabled })
    return renderEditor()
  }
  if (action === 'add-sub') {
    state.groups[gi].subcategories.push(emptySubcategory(state.groups[gi].id))
    expanded.add(sectionId(gi, state.groups[gi].subcategories.length - 1))
    return renderEditor()
  }
  if (action === 'remove-sub') return removeSubcategory(gi, si)
  if (action === 'toggle-sub') {
    const s = state.groups[gi].subcategories[si]
    s.enabled = s.enabled === false
    return renderEditor()
  }
  if (action === 'add-product') {
    const sub = state.groups[gi].subcategories[si]
    sub.products.push(emptyProduct(sub.id))
    expanded.add(sectionId(gi)).add(sectionId(gi, si))
    return renderEditor()
  }
  if (action === 'remove-product') {
    state.groups[gi].subcategories[si].products.splice(pi, 1)
    return renderEditor()
  }
  if (action === 'add-client') {
    state.site = state.site || {}
    if (!Array.isArray(state.site.clients)) state.site.clients = []
    state.site.clients.push({ name: '', comment: '', image: '' })
    expanded.add('clients')
    return renderEditor()
  }
  if (action === 'remove-client') {
    state.site?.clients?.splice(Number(btn.dataset.ci), 1)
    renderEditor()
  }
}

function bindRoot() {
  root.addEventListener('input', (e) => handleEditorInput(e.target))

  root.addEventListener('change', (e) => handleEditorChange(e.target))

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]')
    if (!btn) return
    handleEditorClick(btn)
  })
}

async function init() {
  bindRoot()
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
