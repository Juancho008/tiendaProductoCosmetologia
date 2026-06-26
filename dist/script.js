const formatPrice = (amount) =>
  '$' + Number(amount).toLocaleString('es-CL')

class Cart {
  constructor() {
    this.storageKey = 'elegance-cart'
    this.items = this.load()
    this.countEl = document.querySelector('.js-cart-count')
    this.overlay = document.querySelector('.js-cart-overlay')
    this.panel = document.querySelector('.js-cart-panel')
    this.itemsEl = document.querySelector('.js-cart-items')
    this.emptyEl = document.querySelector('.js-cart-empty')
    this.totalEl = document.querySelector('.js-cart-total-price')
    this.toastEl = document.querySelector('.js-cart-toast')
    this.toastTimer = null

    this.bindEvents()
    this.render()
  }

  load() {
    try {
      const data = localStorage.getItem(this.storageKey)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.items))
  }

  bindEvents() {
    document.querySelector('.js-cart-toggle')?.addEventListener('click', (e) => {
      e.preventDefault()
      this.open()
    })

    document.querySelector('.js-cart-close')?.addEventListener('click', () => this.close())

    this.overlay?.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })

    document.querySelector('.js-cart-clear')?.addEventListener('click', () => {
      this.items = []
      this.save()
      this.render()
    })

    document.querySelector('.js-cart-checkout')?.addEventListener('click', () => {
      if (!this.items.length) return
      alert('¡Gracias por tu compra! Total: ' + formatPrice(this.getTotalPrice()))
      this.items = []
      this.save()
      this.render()
      this.close()
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close()
    })
  }

  addFromProduct(el) {
    const product = {
      id: el.dataset.id,
      name: el.dataset.name,
      price: Number(el.dataset.price),
      image: el.dataset.image
    }

    if (!product.id) return

    this.add(product)
    el.classList.add('is-added')
    setTimeout(() => el.classList.remove('is-added'), 600)
    this.showToast(product.name + ' agregado')
  }

  add(product) {
    const existing = this.items.find((item) => item.id === product.id)
    if (existing) {
      existing.qty += 1
      this.save()
      this.render()
      this.bumpBadge()
      return
    }

    this.items.push({ ...product, qty: 1 })
    this.save()
    this.render()
    this.bumpBadge()
  }

  remove(id) {
    this.items = this.items.filter((item) => item.id !== id)
    this.save()
    this.render()
  }

  setQty(id, qty) {
    const item = this.items.find((i) => i.id === id)
    if (!item) return
    if (qty <= 0) {
      this.remove(id)
      return
    }
    item.qty = qty
    this.save()
    this.render()
  }

  getTotalItems() {
    return this.items.reduce((sum, item) => sum + item.qty, 0)
  }

  getTotalPrice() {
    return this.items.reduce((sum, item) => sum + item.price * item.qty, 0)
  }

  bumpBadge() {
    if (!this.countEl) return
    this.countEl.classList.remove('is-bump')
    void this.countEl.offsetWidth
    this.countEl.classList.add('is-bump')
  }

  showToast(message) {
    if (!this.toastEl) return
    this.toastEl.textContent = message
    this.toastEl.classList.add('is-visible')
    clearTimeout(this.toastTimer)
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('is-visible')
    }, 2200)
  }

  open() {
    this.overlay?.classList.add('is-open')
    this.overlay?.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
  }

  close() {
    this.overlay?.classList.remove('is-open')
    this.overlay?.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
  }

  render() {
    const totalItems = this.getTotalItems()
    const totalPrice = this.getTotalPrice()

    if (this.countEl) this.countEl.textContent = totalItems
    if (this.totalEl) this.totalEl.textContent = formatPrice(totalPrice)

    if (!this.itemsEl || !this.emptyEl) return

    if (!this.items.length) {
      this.itemsEl.innerHTML = ''
      this.emptyEl.classList.remove('is-hidden')
      return
    }

    this.emptyEl.classList.add('is-hidden')
    this.itemsEl.innerHTML = this.items.map((item) => `
      <li class="cart-item" data-id="${item.id}">
        <img class="cart-item__img" src="${item.image}" alt="${item.name}">
        <div class="cart-item__info">
          <span class="cart-item__name">${item.name}</span>
          <span class="cart-item__price">${formatPrice(item.price * item.qty)}</span>
        </div>
        <div class="cart-item__actions">
          <div class="cart-item__qty">
            <button type="button" class="js-cart-minus" data-id="${item.id}" aria-label="Menos">−</button>
            <span>${item.qty}</span>
            <button type="button" class="js-cart-plus" data-id="${item.id}" aria-label="Más">+</button>
          </div>
          <button type="button" class="cart-item__remove js-cart-remove" data-id="${item.id}">Quitar</button>
        </div>
      </li>
    `).join('')

    this.itemsEl.querySelectorAll('.js-cart-minus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = this.items.find((i) => i.id === btn.dataset.id)
        if (item) this.setQty(item.id, item.qty - 1)
      })
    })

    this.itemsEl.querySelectorAll('.js-cart-plus').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = this.items.find((i) => i.id === btn.dataset.id)
        if (item) this.setQty(item.id, item.qty + 1)
      })
    })

    this.itemsEl.querySelectorAll('.js-cart-remove').forEach((btn) => {
      btn.addEventListener('click', () => this.remove(btn.dataset.id))
    })
  }
}

class Slider {
  constructor() {
    this.bindAll()

    this.vert = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
    `

    this.frag = `
    varying vec2 vUv;

    uniform sampler2D texture1;
    uniform sampler2D texture2;
    uniform sampler2D disp;

    uniform float dispPower;
    uniform float intensity;

    uniform vec2 size;
    uniform vec2 res;

    vec2 backgroundCoverUv( vec2 screenSize, vec2 imageSize, vec2 uv ) {
      float screenRatio = screenSize.x / screenSize.y;
      float imageRatio = imageSize.x / imageSize.y;
      vec2 newSize = screenRatio < imageRatio 
          ? vec2(imageSize.x * (screenSize.y / imageSize.y), screenSize.y)
          : vec2(screenSize.x, imageSize.y * (screenSize.x / imageSize.x));
      vec2 newOffset = (screenRatio < imageRatio 
          ? vec2((newSize.x - screenSize.x) / 2.0, 0.0) 
          : vec2(0.0, (newSize.y - screenSize.y) / 2.0)) / newSize;
      return uv * screenSize / newSize + newOffset;
    }

    void main() {
      vec2 uv = vUv;
      
      vec4 disp = texture2D(disp, uv);
      vec2 dispVec = vec2(disp.x, disp.y);
      
      vec2 distPos1 = uv + (dispVec * intensity * dispPower);
      vec2 distPos2 = uv + (dispVec * -(intensity * (1.0 - dispPower)));
      
      vec4 _texture1 = texture2D(texture1, distPos1);
      vec4 _texture2 = texture2D(texture2, distPos2);
      
      vec4 color = mix(_texture1, _texture2, dispPower);
      vec3 bordo = vec3(0.42, 0.11, 0.17);
      color.rgb = mix(color.rgb, color.rgb * bordo * 2.2, 0.38);
      gl_FragColor = color;
    }
    `

    this.el = document.querySelector('.js-slider')
    this.inner = this.el.querySelector('.js-slider__inner')
    this.slides = [...this.el.querySelectorAll('.js-slide')]
    this.bullets = [...this.el.querySelectorAll('.js-slider-bullet')]
    this.scrollHint = document.querySelector('.js-scroll')

    this.renderer = null
    this.scene = null
    this.clock = null
    this.camera = null

    this.images = [
      'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80'
    ]

    this.data = {
      current: 0,
      next: 1,
      total: this.images.length - 1,
      delta: 0
    }

    this.state = {
      animating: false,
      text: false,
      initial: true
    }

    this.slideTl = null
    this.bgTween = null
    this.textures = null

    this.init()
  }

  bindAll() {
    ['render', 'onWheel', 'onTouchStart', 'onTouchEnd', 'onResize', 'nextSlide', 'prevSlide']
      .forEach((fn) => { this[fn] = this[fn].bind(this) })
  }

  getForegroundImages(slide) {
    return slide.querySelectorAll('.slide__img.js-slide__img')
  }

  setStyles() {
    this.slides.forEach((slide, index) => {
      if (index === 0) return
      TweenMax.set(slide, { autoAlpha: 0 })
    })

    const firstImages = this.getForegroundImages(this.slides[0])
    TweenMax.set(firstImages, { autoAlpha: 1, yPercent: 0, scaleY: 1 })

    this.bullets.forEach((bullet, index) => {
      if (index === 0) return
      const txt = bullet.querySelector('.js-slider-bullet__text')
      const line = bullet.querySelector('.js-slider-bullet__line')
      TweenMax.set(txt, { alpha: 0.25 })
      TweenMax.set(line, { scaleX: 0, transformOrigin: 'left' })
    })

    const storeShowcase = document.querySelector('.js-store-showcase')
    if (storeShowcase) TweenMax.set(storeShowcase, { autoAlpha: 0, y: 24 })

    this.updateScrollHint()
  }

  updateScrollHint() {
    if (!this.scrollHint) return
    if (this.data.current === this.data.total) {
      this.scrollHint.textContent = 'Subir'
      TweenMax.set(this.scrollHint, { autoAlpha: 0.55 })
      return
    }
    this.scrollHint.textContent = 'Deslizar'
  }

  cameraSetup() {
    this.camera = new THREE.OrthographicCamera(
      this.el.offsetWidth / -2,
      this.el.offsetWidth / 2,
      this.el.offsetHeight / 2,
      this.el.offsetHeight / -2,
      1,
      1000
    )
    this.camera.lookAt(this.scene.position)
    this.camera.position.z = 1
  }

  setup() {
    this.scene = new THREE.Scene()
    this.clock = new THREE.Clock(true)
    this.renderer = new THREE.WebGLRenderer({ alpha: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(this.el.offsetWidth, this.el.offsetHeight)
    this.inner.appendChild(this.renderer.domElement)
  }

  loadTextures() {
    const loader = new THREE.TextureLoader()
    loader.crossOrigin = 'anonymous'

    this.textures = []
    this.images.forEach((image, index) => {
      const texture = loader.load(image + '?v=' + Date.now(), this.render)
      texture.minFilter = THREE.LinearFilter
      texture.generateMipmaps = false
      if (index === 0 && this.mat) {
        this.mat.uniforms.size.value = [
          texture.image.naturalWidth,
          texture.image.naturalHeight
        ]
      }
      this.textures.push(texture)
    })

    this.disp = loader.load('https://s3-us-west-2.amazonaws.com/s.cdpn.io/58281/rock-_disp.png', this.render)
    this.disp.magFilter = this.disp.minFilter = THREE.LinearFilter
    this.disp.wrapS = this.disp.wrapT = THREE.RepeatWrapping
  }

  createMesh() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        dispPower: { type: 'f', value: 0.0 },
        intensity: { type: 'f', value: 0.38 },
        res: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        size: { value: new THREE.Vector2(1, 1) },
        texture1: { type: 't', value: this.textures[0] },
        texture2: { type: 't', value: this.textures[1] },
        disp: { type: 't', value: this.disp }
      },
      transparent: true,
      vertexShader: this.vert,
      fragmentShader: this.frag
    })

    const geometry = new THREE.PlaneBufferGeometry(
      this.el.offsetWidth,
      this.el.offsetHeight,
      1
    )
    const mesh = new THREE.Mesh(geometry, this.mat)
    this.mesh = mesh
    this.scene.add(mesh)
  }

  isStoreSlide(slide) {
    return slide && slide.querySelector('.store-grid')
  }

  finishTransition() {
    this.state.animating = false
    this.updateScrollHint()
  }

  killAnimations() {
    if (this.slideTl) {
      this.slideTl.kill()
      this.slideTl = null
    }

    if (this.bgTween) {
      this.bgTween.kill()
      this.bgTween = null
    }

    TweenMax.killTweensOf(this.mat.uniforms.dispPower)

    this.slides.forEach((slide) => {
      TweenMax.killTweensOf(slide)
      TweenMax.killTweensOf(this.getForegroundImages(slide))
      slide.querySelectorAll('.js-slider__text-line div').forEach((el) => {
        TweenMax.killTweensOf(el)
      })
      const showcase = slide.querySelector('.js-store-showcase')
      if (showcase) TweenMax.killTweensOf(showcase)
    })
  }

  normalizeSlide(index) {
    const slide = this.slides[index]
    if (!slide) return

    TweenMax.set(slide, { autoAlpha: 1 })

    if (this.isStoreSlide(slide)) {
      const showcase = slide.querySelector('.js-store-showcase')
      if (showcase) {
        TweenMax.set(showcase, { autoAlpha: 1, y: 0, clearProps: 'transform' })
      }
    } else {
      const images = this.getForegroundImages(slide)
      TweenMax.set(images, { autoAlpha: 1, yPercent: 0, scaleY: 1, clearProps: 'transform' })
    }

    slide.querySelectorAll('.js-slider__text-line div').forEach((el) => {
      TweenMax.set(el, { yPercent: 0, clearProps: 'transform' })
    })
  }

  hideInactiveSlides() {
    this.slides.forEach((slide, index) => {
      if (index === this.data.current) {
        this.normalizeSlide(index)
        return
      }

      TweenMax.set(slide, { autoAlpha: 0 })
      TweenMax.set(this.getForegroundImages(slide), { clearProps: 'all' })

      const showcase = slide.querySelector('.js-store-showcase')
      if (showcase) TweenMax.set(showcase, { clearProps: 'all' })
    })

    this.bullets.forEach((bullet, index) => {
      const txt = bullet.querySelector('.js-slider-bullet__text')
      const line = bullet.querySelector('.js-slider-bullet__line')
      const active = index === this.data.current

      TweenMax.set(txt, { alpha: active ? 1 : 0.25 })
      TweenMax.set(line, {
        scaleX: active ? 1 : 0,
        transformOrigin: active ? 'left' : 'right'
      })
    })
  }

  syncBgTextures(index) {
    this.mat.uniforms.dispPower.value = 0
    this.mat.uniforms.texture1.value = this.textures[index]
    this.mat.uniforms.texture2.value = this.textures[
      index === this.data.total ? index : index + 1
    ]
    this.render()
  }

  runBgTransition(fromIndex, toIndex, reverse = false) {
    const easeFlow = Power3.easeInOut
    const landedIndex = reverse ? fromIndex : toIndex

    this.mat.uniforms.texture1.value = this.textures[fromIndex]
    this.mat.uniforms.texture2.value = this.textures[toIndex]

    const onComplete = () => {
      this.syncBgTextures(landedIndex)
      this.render()
    }

    if (reverse) {
      this.mat.uniforms.dispPower.value = 1
      this.bgTween = TweenMax.to(this.mat.uniforms.dispPower, 3.2, {
        value: 0,
        ease: easeFlow,
        onUpdate: this.render,
        onComplete
      })
      return
    }

    this.bgTween = TweenMax.to(this.mat.uniforms.dispPower, 3.2, {
      value: 1,
      ease: easeFlow,
      onUpdate: this.render,
      onComplete
    })
  }

  animateLeavingContent(tl, opts) {
    const { leaving, leavingIsStore, leavingImages, leavingText, isForward, dur, easeFlow } = opts
    const exitY = isForward ? -145 : 145

    if (leavingIsStore) {
      const leavingShowcase = leaving.querySelector('.js-store-showcase')
      tl.to(leavingShowcase, 1.7, {
        autoAlpha: 0,
        y: isForward ? -28 : 28,
        ease: easeFlow
      }, 0)
    } else {
      tl.staggerTo(leavingImages, dur.image, {
        yPercent: exitY,
        scaleY: 1.1,
        ease: easeFlow
      }, 0.07, 0)
    }

    if (!leavingText.length) return
    tl.staggerTo(leavingText, dur.text, {
      yPercent: isForward ? -100 : 100,
      ease: easeFlow
    }, 0.07, 0)
  }

  animateEnteringContent(tl, opts) {
    const {
      entering,
      enteringIsStore,
      enteringImages,
      enteringText,
      isForward,
      switchAt,
      dur,
      easeOut
    } = opts
    const enterFromY = isForward ? 145 : -145

    if (enteringText.length) {
      tl.staggerFromTo(enteringText, dur.text, {
        yPercent: isForward ? 100 : -100
      }, {
        yPercent: 0,
        ease: easeOut
      }, 0.07, switchAt + 0.25)
    }

    if (enteringIsStore) {
      const enteringShowcase = entering.querySelector('.js-store-showcase')
      TweenMax.set(enteringShowcase, { autoAlpha: 0, y: isForward ? 32 : -32 })
      tl.to(enteringShowcase, 2, {
        autoAlpha: 1,
        y: 0,
        ease: easeOut
      }, switchAt + 0.2)
      return
    }

    TweenMax.set(enteringImages, { autoAlpha: 1 })
    tl.staggerFromTo(enteringImages, dur.image, {
      yPercent: enterFromY,
      scaleY: 1.1
    }, {
      yPercent: 0,
      scaleY: 1,
      ease: easeOut
    }, 0.07, switchAt + 0.2)
  }

  animateSlideChange(leaving, entering, direction) {
    const easeFlow = Power3.easeInOut
    const easeOut = Power3.easeOut
    const switchAt = 1.45
    const isForward = direction === 'forward'
    const dur = { image: 2.1, grid: 1.9, text: 2.2, bullet: 2, storeTitle: 2 }

    const leavingImages = this.getForegroundImages(leaving)
    const enteringImages = this.getForegroundImages(entering)
    const leavingIsStore = this.isStoreSlide(leaving)
    const enteringIsStore = this.isStoreSlide(entering)
    const leavingText = leaving.querySelectorAll('.js-slider__text-line div')
    const enteringText = entering.querySelectorAll('.js-slider__text-line div')

    const leaveIdx = this.slides.indexOf(leaving)
    const enterIdx = this.slides.indexOf(entering)
    const leaveBullet = this.bullets[leaveIdx]
    const enterBullet = this.bullets[enterIdx]
    const leaveBulletTxt = leaveBullet.querySelectorAll('.js-slider-bullet__text')
    const enterBulletTxt = enterBullet.querySelectorAll('.js-slider-bullet__text')
    const leaveBulletLine = leaveBullet.querySelectorAll('.js-slider-bullet__line')
    const enterBulletLine = enterBullet.querySelectorAll('.js-slider-bullet__line')

    const tl = new TimelineMax({
      paused: true,
      onComplete: () => {
        this.hideInactiveSlides()
        this.slideTl = null
        this.finishTransition()
      }
    })

    this.slideTl = tl

    if (this.state.initial) {
      TweenMax.to('.js-scroll', 2, { yPercent: 80, autoAlpha: 0, ease: easeFlow })
      this.state.initial = false
    }

    this.animateLeavingContent(tl, {
      leaving,
      leavingIsStore,
      leavingImages,
      leavingText,
      isForward,
      dur,
      easeFlow
    })

    tl.to(leaveBulletTxt, dur.bullet, { alpha: 0.25, ease: easeFlow }, 0)
    tl.set(leaveBulletLine, { transformOrigin: 'right' }, 0)
    tl.to(leaveBulletLine, dur.bullet, { scaleX: 0, ease: easeFlow }, 0)

    tl.set(leaving, { autoAlpha: 0 }, switchAt)
    tl.set(entering, { autoAlpha: 1 }, switchAt)

    this.animateEnteringContent(tl, {
      entering,
      enteringIsStore,
      enteringImages,
      enteringText,
      isForward,
      switchAt,
      dur,
      easeOut
    })

    tl.to(enterBulletTxt, dur.bullet, { alpha: 1, ease: easeFlow }, switchAt)
    tl.set(enterBulletLine, { transformOrigin: 'left' }, switchAt)
    tl.to(enterBulletLine, dur.bullet, { scaleX: 1, ease: easeFlow }, switchAt)

    tl.play()
  }

  transitionNext(oldCurrent, newCurrent) {
    this.runBgTransition(oldCurrent, newCurrent, false)
    this.animateSlideChange(this.slides[oldCurrent], this.slides[newCurrent], 'forward')
  }

  transitionPrev(oldCurrent, newCurrent) {
    this.runBgTransition(newCurrent, oldCurrent, true)
    this.animateSlideChange(this.slides[oldCurrent], this.slides[newCurrent], 'backward')
  }

  beginTransition(oldCurrent, newCurrent, direction) {
    if (this.state.animating) return false

    this.killAnimations()
    this.normalizeSlide(oldCurrent)
    this.state.animating = true
    this.data.current = newCurrent
    this.data.next = newCurrent === this.data.total ? newCurrent : newCurrent + 1

    if (direction === 'forward') {
      this.transitionNext(oldCurrent, newCurrent)
      return true
    }

    this.transitionPrev(oldCurrent, newCurrent)
    return true
  }

  nextSlide() {
    if (this.state.animating) return
    if (this.data.current >= this.data.total) return

    const oldCurrent = this.data.current
    const newCurrent = oldCurrent + 1
    this.beginTransition(oldCurrent, newCurrent, 'forward')
  }

  prevSlide() {
    if (this.state.animating) return
    if (this.data.current <= 0) return

    const oldCurrent = this.data.current
    const newCurrent = oldCurrent - 1
    this.beginTransition(oldCurrent, newCurrent, 'backward')
  }

  goToSlide(index) {
    if (this.state.animating) return
    if (index === this.data.current) return
    if (index > this.data.current) {
      this.nextSlide()
      return
    }
    this.prevSlide()
  }

  onWheel(e) {
    if (this.state.animating) return

    if (e.deltaY > 0) {
      if (this.data.current >= this.data.total) return
      this.nextSlide()
      return
    }

    if (e.deltaY >= 0) return
    if (this.data.current <= 0) return
    this.prevSlide()
  }

  onTouchStart(e) {
    this.touchStartY = e.touches[0].clientY
    this.touchStartX = e.touches[0].clientX
    this.touchInStoreGrid = !!e.target.closest('.js-carousel')
  }

  onTouchEnd(e) {
    if (this.state.animating) return

    const deltaY = this.touchStartY - e.changedTouches[0].clientY
    const deltaX = this.touchStartX - e.changedTouches[0].clientX

    if (this.touchInStoreGrid && this.data.current === this.data.total) {
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) return
    }

    if (Math.abs(deltaY) < 45) return

    if (deltaY > 0) {
      if (this.data.current >= this.data.total) return
      this.nextSlide()
      return
    }

    if (this.data.current <= 0) return
    this.prevSlide()
  }

  onResize() {
    const w = this.el.offsetWidth
    const h = this.el.offsetHeight

    this.renderer.setSize(w, h)
    this.camera.left = w / -2
    this.camera.right = w / 2
    this.camera.top = h / 2
    this.camera.bottom = h / -2
    this.camera.updateProjectionMatrix()

    if (this.mesh) {
      this.mesh.geometry.dispose()
      this.mesh.geometry = new THREE.PlaneBufferGeometry(w, h, 1)
    }

    this.mat.uniforms.res.value.set(window.innerWidth, window.innerHeight)
    this.render()
  }

  listeners() {
    window.addEventListener('wheel', this.onWheel, { passive: true })
    this.el.addEventListener('touchstart', this.onTouchStart, { passive: true })
    this.el.addEventListener('touchend', this.onTouchEnd, { passive: true })
    window.addEventListener('resize', this.onResize)

    this.bullets.forEach((bullet, index) => {
      bullet.addEventListener('click', () => this.goToSlide(index))
    })
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }

  init() {
    this.setup()
    this.cameraSetup()
    this.loadTextures()
    this.createMesh()
    this.setStyles()
    this.render()
    this.listeners()
  }
}

class ProductCarousel {
  constructor(root) {
    this.root = root
    this.viewport = root.querySelector('.js-carousel-viewport')
    this.track = root.querySelector('.js-carousel-track')
    this.items = [...this.track.querySelectorAll('.store-grid__item')]
    this.prevBtn = root.querySelector('.js-carousel-prev')
    this.nextBtn = root.querySelector('.js-carousel-next')
    this.dotsEl = root.querySelector('.js-carousel-dots')
    this.slide = root.closest('.js-slide')

    this.page = 0
    this.perView = this.getPerView()
    this.autoplayDelay = 5000
    this.autoplayTimer = null
    this.swipe = { x: 0, y: 0, active: false }

    this.bind()
    this.build()
    this.startAutoplay()
  }

  getPerView() {
    return window.innerWidth <= 768 ? 2 : 4
  }

  get itemsPerPage() {
    return this.perView * 2
  }

  get pageCount() {
    return Math.max(1, Math.ceil(this.items.length / this.itemsPerPage))
  }

  build() {
    this.root.style.setProperty('--per-view', this.perView)
    this.buildDots()
    this.update(false)
  }

  buildDots() {
    this.dotsEl.innerHTML = ''
    this.dots = []
    for (let i = 0; i < this.pageCount; i += 1) {
      const dot = document.createElement('button')
      dot.type = 'button'
      dot.className = 'carousel__dot'
      dot.setAttribute('role', 'tab')
      dot.setAttribute('aria-label', 'Página ' + (i + 1))
      dot.addEventListener('click', () => this.goTo(i, true))
      this.dotsEl.appendChild(dot)
      this.dots.push(dot)
    }
  }

  update(animate = true) {
    const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0
    const width = this.viewport.clientWidth
    const offset = this.page * (width + gap)

    this.track.style.transition = animate
      ? ''
      : 'none'
    this.track.style.transform = 'translateX(' + -offset + 'px)'

    if (!animate) {
      void this.track.offsetWidth
      this.track.style.transition = ''
    }

    this.dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === this.page)
    })

    this.animateItems()
  }

  animateItems() {
    if (!window.TweenMax) return

    const start = this.page * this.itemsPerPage
    const visibleItems = this.items.slice(start, start + this.itemsPerPage)
    if (!visibleItems.length) return

    TweenMax.killTweensOf(visibleItems)
    TweenMax.staggerFromTo(visibleItems, 0.7, {
      autoAlpha: 0.25,
      y: 28,
      scale: 0.93
    }, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      ease: Power3.easeOut,
      delay: 0.1,
      clearProps: 'transform,opacity,visibility'
    }, 0.09)
  }

  goTo(page, fromUser = false) {
    const count = this.pageCount
    this.page = ((page % count) + count) % count
    this.update(true)
    if (fromUser) this.restartAutoplay()
  }

  next(fromUser = false) {
    this.goTo(this.page + 1, fromUser)
  }

  prev(fromUser = false) {
    this.goTo(this.page - 1, fromUser)
  }

  startAutoplay() {
    this.stopAutoplay()
    this.autoplayTimer = setInterval(() => {
      if (this.slide && getComputedStyle(this.slide).visibility === 'hidden') return
      this.next(false)
    }, this.autoplayDelay)
  }

  stopAutoplay() {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer)
      this.autoplayTimer = null
    }
  }

  restartAutoplay() {
    this.startAutoplay()
  }

  onResize() {
    const nextPerView = this.getPerView()
    if (nextPerView !== this.perView) {
      this.perView = nextPerView
      this.root.style.setProperty('--per-view', this.perView)
      this.page = Math.min(this.page, this.pageCount - 1)
      this.buildDots()
    }
    this.update(false)
  }

  reload() {
    this.items = [...this.track.querySelectorAll('.store-grid__item')]
    this.page = 0
    this.perView = this.getPerView()
    this.root.style.setProperty('--per-view', this.perView)
    this.buildDots()
    this.update(false)
    this.restartAutoplay()
  }

  bind() {
    this.prevBtn?.addEventListener('click', () => this.prev(true))
    this.nextBtn?.addEventListener('click', () => this.next(true))

    this.root.addEventListener('mouseenter', () => this.stopAutoplay())
    this.root.addEventListener('mouseleave', () => this.startAutoplay())

    this.viewport.addEventListener('touchstart', (e) => {
      this.swipe.x = e.touches[0].clientX
      this.swipe.y = e.touches[0].clientY
      this.swipe.active = true
      this.stopAutoplay()
    }, { passive: true })

    this.viewport.addEventListener('touchend', (e) => {
      if (!this.swipe.active) return
      this.swipe.active = false

      const dx = e.changedTouches[0].clientX - this.swipe.x
      const dy = e.changedTouches[0].clientY - this.swipe.y
      if (Math.abs(dx) <= 40 || Math.abs(dx) <= Math.abs(dy)) {
        this.startAutoplay()
        return
      }

      if (dx < 0) this.next(true)
      else this.prev(true)
    }, { passive: true })

    window.addEventListener('resize', () => this.onResize())
  }
}

const ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
const ICON_BAG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>'

const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="%231e0a0e"/><text x="50%" y="50%" fill="%23c9a962" font-family="serif" font-size="28" text-anchor="middle" dy=".35em">Élégance</text></svg>'
  )

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const API_BASE = (window.ELEGANCE_CONFIG && window.ELEGANCE_CONFIG.apiBase) || ''
const apiUrl = (path) => `${API_BASE}${path}`
const resolveImg = (url) =>
  url && url.startsWith('/') ? `${API_BASE}${url}` : url

function renderProducts(track, products) {
  if (!track) return
  if (!Array.isArray(products) || !products.length) {
    track.innerHTML = ''
    return
  }

  track.innerHTML = products
    .map((p) => {
      const image = resolveImg(p.image) || PLACEHOLDER_IMG
      return `
      <figure class="store-grid__item js-slide__img js-product"
        data-id="${escapeHtml(p.id)}"
        data-name="${escapeHtml(p.name)}"
        data-price="${escapeHtml(p.price)}"
        data-image="${escapeHtml(image)}"
        data-description="${escapeHtml(p.description)}">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(p.name)}">
        <figcaption class="store-grid__caption">
          <span class="store-grid__name">${escapeHtml(p.name)}</span>
          <span class="store-grid__price">${formatPrice(Number(p.price))}</span>
        </figcaption>
      </figure>`
    })
    .join('')
}

class QuickView {
  constructor(cart, carousel) {
    this.cart = cart
    this.carousel = carousel
    this.overlay = document.querySelector('.js-quickview-overlay')
    this.img = document.querySelector('.js-quickview-img')
    this.nameEl = document.querySelector('.js-quickview-name')
    this.priceEl = document.querySelector('.js-quickview-price')
    this.descEl = document.querySelector('.js-quickview-desc')
    this.addBtn = document.querySelector('.js-quickview-add')
    this.currentEl = null

    this.setupProducts()
    this.bind()
  }

  setupProducts() {
    document.querySelectorAll('.js-product').forEach((product) => {
      const actions = document.createElement('div')
      actions.className = 'product-actions'

      const viewBtn = document.createElement('button')
      viewBtn.type = 'button'
      viewBtn.className = 'product-action js-product-view'
      viewBtn.setAttribute('aria-label', 'Ver detalle de ' + product.dataset.name)
      viewBtn.innerHTML = ICON_SEARCH

      const addBtn = document.createElement('button')
      addBtn.type = 'button'
      addBtn.className = 'product-action js-product-add'
      addBtn.setAttribute('aria-label', 'Agregar ' + product.dataset.name + ' al carrito')
      addBtn.innerHTML = ICON_BAG

      actions.appendChild(viewBtn)
      actions.appendChild(addBtn)
      product.appendChild(actions)

      viewBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.open(product)
      })

      addBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        this.cart.addFromProduct(product)
      })

      product.addEventListener('click', () => this.open(product))
    })
  }

  bind() {
    document.querySelector('.js-quickview-close')?.addEventListener('click', () => this.close())

    this.overlay?.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close()
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close()
    })

    this.addBtn?.addEventListener('click', () => {
      if (this.currentEl) this.cart.addFromProduct(this.currentEl)
      this.close()
    })
  }

  open(el) {
    if (!this.overlay || !el) return
    this.currentEl = el

    const { name, price, image, description } = el.dataset
    const bigImage = (image || '').replace('w=400', 'w=900')

    this.img.src = bigImage || image || PLACEHOLDER_IMG
    this.img.alt = name || ''
    this.nameEl.textContent = name || ''
    this.priceEl.textContent = formatPrice(Number(price))
    this.descEl.textContent = description || ''

    this.overlay.classList.add('is-open')
    this.overlay.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
    this.carousel?.stopAutoplay()
  }

  close() {
    if (!this.overlay) return
    this.overlay.classList.remove('is-open')
    this.overlay.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
    this.carousel?.startAutoplay()
  }
}

const links = document.querySelectorAll('.js-nav a')

links.forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault()
    links.forEach((other) => other.classList.remove('is-active'))
    link.classList.add('is-active')
  })
})

async function fetchCatalog() {
  try {
    const r = await fetch(apiUrl('/api/catalog'), { cache: 'no-store' })
    if (!r.ok) throw new Error('catalog')
    return await r.json()
  } catch {
    return { site: {}, categories: [] }
  }
}

function normalizeCategories(catalog) {
  if (Array.isArray(catalog.categories)) {
    return catalog.categories.filter((c) => Array.isArray(c.products) && c.products.length)
  }
  if (!Array.isArray(catalog.products) || !catalog.products.length) {
    return []
  }
  return [{ id: 'productos', label: 'Productos', emoji: '💄', products: catalog.products }]
}

function renderCategoryTabs(container, categories, onSelect) {
  if (!container) return
  if (categories.length <= 1) {
    container.innerHTML = ''
    return
  }
  const tabs = [
    { id: 'all', label: 'Todos', emoji: '✨' },
    ...categories.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji }))
  ]
  container.innerHTML = tabs
    .map(
      (t, i) =>
        `<button type="button" class="store-cat${i === 0 ? ' is-active' : ''}" data-cat="${escapeHtml(t.id)}"><span class="store-cat__emoji">${escapeHtml(t.emoji || '')}</span>${escapeHtml(t.label)}</button>`
    )
    .join('')

  container.querySelectorAll('.store-cat').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.store-cat').forEach((b) => b.classList.remove('is-active'))
      btn.classList.add('is-active')
      onSelect(btn.dataset.cat)
    })
  })
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

async function boot() {
  const catalog = await fetchCatalog()
  const categories = normalizeCategories(catalog)
  const allProducts = categories.flatMap((c) => c.products)

  const track = document.querySelector('.js-carousel-track')
  renderProducts(track, allProducts)

  const cart = new Cart()
  const slider = new Slider()

  const carouselEl = document.querySelector('.js-carousel')
  const productCarousel = carouselEl ? new ProductCarousel(carouselEl) : null
  const quickView = new QuickView(cart, productCarousel)

  const catsEl = document.querySelector('.js-store-cats')
  const searchInput = document.querySelector('.js-store-search')
  const emptyEl = document.querySelector('.js-store-empty')

  let currentCat = 'all'
  let currentQuery = ''

  const applyFilter = () => {
    const base =
      currentCat === 'all'
        ? allProducts
        : categories.find((c) => c.id === currentCat)?.products || []
    const q = normalizeText(currentQuery.trim())
    const list = q
      ? base.filter(
          (p) =>
            normalizeText(p.name).includes(q) ||
            normalizeText(p.description).includes(q)
        )
      : base

    renderProducts(track, list)
    quickView.setupProducts()
    productCarousel?.reload()
    if (emptyEl) emptyEl.hidden = list.length > 0
  }

  renderCategoryTabs(catsEl, categories, (catId) => {
    currentCat = catId
    applyFilter()
  })

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentQuery = searchInput.value
      applyFilter()
    })
  }

  window.__elegance = { cart, slider, productCarousel, quickView, applyFilter }
}

boot()
