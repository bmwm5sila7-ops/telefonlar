import { PHONES_CATALOG, formatUZS } from './catalog.js';
import { Phone3DStage } from './phone3d.js';
import { sendOrderToTelegram } from './telegram.js';

const CART_STORAGE_KEY = 'samo_mobile_cart_v1';

const state = {
  brandFilter: 'all',
  searchQuery: '',
  sortBy: 'featured',
  heroPhoneId: PHONES_CATALOG[0].id,
  heroColorId: PHONES_CATALOG[0].colors[0].id,
  cardSelections: {},
  cart: loadCart(),
  modalPhoneId: null,
  modalColorId: null,
  modalStorage: null
};

PHONES_CATALOG.forEach((phone) => {
  state.cardSelections[phone.id] = {
    storage: phone.storageOptions[0].size,
    colorId: phone.colors[0].id
  };
});

let heroStage = null;
let modalStage = null;

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
  } catch {
    // Ignore storage quota restrictions
  }
}

function showToast(message) {
  const region = document.getElementById('toast-region');
  const toast = document.createElement('div');
  toast.className = 'toast-item';
  toast.textContent = message;
  region.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 3200);
}

function getPhoneById(id) {
  return PHONES_CATALOG.find((p) => p.id === id) || PHONES_CATALOG[0];
}

function getColorById(phone, colorId) {
  return phone.colors.find((c) => c.id === colorId) || phone.colors[0];
}

function getStorageOption(phone, size) {
  return phone.storageOptions.find((s) => s.size === size) || phone.storageOptions[0];
}

/* =========================================================
   Hero 3D Studio Controls
   ========================================================= */
function initHeroStage() {
  const wrap = document.getElementById('hero-3d-canvas-wrap');
  const initialPhone = getPhoneById(state.heroPhoneId);
  const initialColor = getColorById(initialPhone, state.heroColorId);

  try {
    heroStage = new Phone3DStage(wrap, {
      initialPhone,
      initialColor
    });
  } catch {
    document.getElementById('hero-3d-fallback').hidden = false;
  }

  renderHeroDock();
  updateHeroStageHeader();

  // Dock Collapse / Expand
  const dockContainer = document.getElementById('hero-dock-container');
  const dockToggle = document.getElementById('hero-dock-toggle');
  const dockToggleLabel = document.getElementById('hero-dock-toggle-label');

  dockToggle.addEventListener('click', () => {
    const collapsed = dockContainer.classList.toggle('is-collapsed');
    dockToggle.setAttribute('aria-expanded', String(!collapsed));
    dockToggleLabel.textContent = collapsed ? "Boshqaruvni ko'rsatish" : 'Boshqaruvni yashirish';
  });

  // Camera buttons
  document.getElementById('hero-camera-buttons').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cam]');
    if (!btn || !heroStage) return;
    document.querySelectorAll('#hero-camera-buttons .dock-mini-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    heroStage.setCameraPreset(btn.dataset.cam);
  });

  // Explode slider
  const explodeSlider = document.getElementById('hero-explode-slider');
  const explodeVal = document.getElementById('hero-explode-val');
  explodeSlider.addEventListener('input', () => {
    const pct = Number(explodeSlider.value);
    explodeVal.textContent = `${pct}%`;
    heroStage?.setExplode(pct / 100);
  });

  // Hero "Order Active Phone" CTA
  document.getElementById('hero-order-active-btn').addEventListener('click', () => {
    const phone = getPhoneById(state.heroPhoneId);
    const color = getColorById(phone, state.heroColorId);
    const storageOpt = phone.storageOptions[0];
    addToCart(phone, storageOpt.size, color, storageOpt.price);
    openCartDrawer();
  });
}

function renderHeroDock() {
  const modelListEl = document.getElementById('hero-model-buttons');
  modelListEl.innerHTML = '';

  PHONES_CATALOG.forEach((phone) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `dock-model-btn${phone.id === state.heroPhoneId ? ' active' : ''}`;
    btn.textContent = phone.name;
    btn.addEventListener('click', () => {
      state.heroPhoneId = phone.id;
      state.heroColorId = phone.colors[0].id;
      heroStage?.setPhone(phone, phone.colors[0]);
      renderHeroDock();
      updateHeroStageHeader();
    });
    modelListEl.appendChild(btn);
  });

  const activePhone = getPhoneById(state.heroPhoneId);
  const swatchRow = document.getElementById('hero-color-swatches');
  swatchRow.innerHTML = '';

  activePhone.colors.forEach((color) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `swatch-btn${color.id === state.heroColorId ? ' active' : ''}`;
    btn.style.backgroundColor = color.hex;
    btn.title = color.name;
    btn.setAttribute('aria-label', color.name);
    btn.addEventListener('click', () => {
      state.heroColorId = color.id;
      heroStage?.setColor(color);
      renderHeroDock();
      updateHeroStageHeader();
    });
    swatchRow.appendChild(btn);
  });
}

function updateHeroStageHeader() {
  const phone = getPhoneById(state.heroPhoneId);
  const color = getColorById(phone, state.heroColorId);
  document.getElementById('hero-3d-brand').textContent = phone.brand;
  document.getElementById('hero-3d-name').textContent = phone.name;
  document.getElementById('hero-3d-color-label').textContent = color.name;
  document.getElementById('hero-3d-price').textContent = formatUZS(phone.storageOptions[0].price);
}

/* =========================================================
   Catalog Rendering & 3D Card Perspective Hover
   ========================================================= */
function getFilteredCatalog() {
  const q = state.searchQuery.trim().toLowerCase();
  let list = PHONES_CATALOG.filter((phone) => {
    const brandMatch = state.brandFilter === 'all' || phone.brand === state.brandFilter;
    const textMatch =
      !q ||
      phone.name.toLowerCase().includes(q) ||
      phone.brand.toLowerCase().includes(q) ||
      phone.shortSpecs.toLowerCase().includes(q);
    return brandMatch && textMatch;
  });

  if (state.sortBy === 'price-asc') {
    list = [...list].sort((a, b) => a.storageOptions[0].price - b.storageOptions[0].price);
  } else if (state.sortBy === 'price-desc') {
    list = [...list].sort((a, b) => b.storageOptions[0].price - a.storageOptions[0].price);
  }

  return list;
}

function renderCatalog() {
  const grid = document.getElementById('catalog-grid');
  const empty = document.getElementById('catalog-empty');
  const phones = getFilteredCatalog();

  grid.innerHTML = '';
  empty.hidden = phones.length > 0;

  phones.forEach((phone) => {
    const sel = state.cardSelections[phone.id];
    const activeStorage = getStorageOption(phone, sel.storage);
    const activeColor = getColorById(phone, sel.colorId);

    const card = document.createElement('article');
    card.className = 'product-card';

    card.innerHTML = `
      <div class="card-media">
        <img
          src="${phone.image}"
          alt="${phone.name} — ${activeColor.name}"
          loading="lazy"
          referrerpolicy="no-referrer"
        />
        <button type="button" class="card-3d-trigger" data-action="inspect-3d" data-id="${phone.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          <span>3D Ko'rish</span>
        </button>
      </div>
      <div class="card-body">
        <div class="card-meta">
          <span>${phone.brand}</span>
          <span aria-hidden="true">·</span>
          <span>${phone.year}</span>
          <span aria-hidden="true">·</span>
          <span>${activeColor.name}</span>
        </div>
        <h3 class="card-title">${phone.name}</h3>
        <p class="card-specs">${phone.shortSpecs}</p>

        <div class="card-variants">
          <div class="storage-row" data-role="storage-row">
            ${phone.storageOptions
              .map(
                (opt) => `
              <button
                type="button"
                class="storage-btn${opt.size === activeStorage.size ? ' active' : ''}"
                data-action="select-storage"
                data-id="${phone.id}"
                data-storage="${opt.size}"
              >${opt.size}</button>`
              )
              .join('')}
          </div>
          <div class="swatch-row" data-role="color-row">
            ${phone.colors
              .map(
                (c) => `
              <button
                type="button"
                class="swatch-btn${c.id === activeColor.id ? ' active' : ''}"
                style="background-color: ${c.hex}"
                title="${c.name}"
                aria-label="${c.name}"
                data-action="select-color"
                data-id="${phone.id}"
                data-color="${c.id}"
              ></button>`
              )
              .join('')}
          </div>
        </div>

        <div class="card-footer">
          <div class="card-price-wrap">
            <span class="card-price-label">${activeStorage.size} · Rasmiy kafolat</span>
            <strong class="card-price tabular-nums">${formatUZS(activeStorage.price)}</strong>
          </div>
          <button
            type="button"
            class="card-add-btn"
            data-action="add-cart"
            data-id="${phone.id}"
          >Savatga</button>
        </div>
      </div>
    `;

    // Resilient image fallback
    const imgEl = card.querySelector('img');
    imgEl.addEventListener('error', () => {
      const mediaWrap = card.querySelector('.card-media');
      imgEl.remove();
      const fallback = document.createElement('div');
      fallback.className = 'card-media-fallback';
      fallback.innerHTML = `<strong>${phone.name}</strong><span>${phone.brand}</span>`;
      mediaWrap.prepend(fallback);
    });

    // Subtle 3D CSS perspective hover tilt on pointer devices
    card.addEventListener('mousemove', (e) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(1000px) rotateX(${(-py * 5).toFixed(2)}deg) rotateY(${(px * 6).toFixed(2)}deg) translateY(-3px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });

    grid.appendChild(card);
  });
}

function initCatalogInteractions() {
  document.getElementById('brand-filter-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-brand]');
    if (!btn) return;
    document.querySelectorAll('#brand-filter-tabs .filter-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.brandFilter = btn.dataset.brand;
    renderCatalog();
  });

  document.getElementById('catalog-search').addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderCatalog();
  });

  document.getElementById('catalog-sort').addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderCatalog();
  });

  document.getElementById('reset-filters-btn').addEventListener('click', () => {
    state.brandFilter = 'all';
    state.searchQuery = '';
    state.sortBy = 'featured';
    document.getElementById('catalog-search').value = '';
    document.getElementById('catalog-sort').value = 'featured';
    document.querySelectorAll('#brand-filter-tabs .filter-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.brand === 'all');
    });
    renderCatalog();
  });

  document.getElementById('catalog-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const phone = getPhoneById(btn.dataset.id);
    const sel = state.cardSelections[phone.id];

    if (action === 'select-storage') {
      sel.storage = btn.dataset.storage;
      renderCatalog();
    } else if (action === 'select-color') {
      sel.colorId = btn.dataset.color;
      renderCatalog();
    } else if (action === 'add-cart') {
      const storageOpt = getStorageOption(phone, sel.storage);
      const color = getColorById(phone, sel.colorId);
      addToCart(phone, storageOpt.size, color, storageOpt.price);
    } else if (action === 'inspect-3d') {
      open3DModal(phone.id, sel.colorId, sel.storage);
    }
  });
}

/* =========================================================
   Comparison Table
   ========================================================= */
function renderComparisonTable() {
  const tbody = document.getElementById('compare-table-body');
  tbody.innerHTML = PHONES_CATALOG.map(
    (p) => `
    <tr>
      <td class="table-model-cell">
        <strong>${p.name}</strong>
        <span>${p.brand} · ${p.year}</span>
      </td>
      <td>${p.screen}</td>
      <td>${p.chip}</td>
      <td>${p.camera}</td>
      <td class="tabular-nums">${p.battery}</td>
      <td class="tabular-nums">${formatUZS(p.storageOptions[0].price)}</td>
      <td>
        <button type="button" class="table-action-btn" data-compare-3d="${p.id}">3D Ko'rish</button>
      </td>
    </tr>`
  ).join('');

  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-compare-3d]');
    if (!btn) return;
    const phone = getPhoneById(btn.dataset.compare3d);
    const sel = state.cardSelections[phone.id];
    open3DModal(phone.id, sel.colorId, sel.storage);
  });
}

/* =========================================================
   3D Product Inspector Modal
   ========================================================= */
function open3DModal(phoneId, colorId, storage) {
  const phone = getPhoneById(phoneId);
  state.modalPhoneId = phone.id;
  state.modalColorId = colorId || phone.colors[0].id;
  state.modalStorage = storage || phone.storageOptions[0].size;

  const modal = document.getElementById('modal-3d');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  // Pause background Hero WebGL loop while modal 3D stage is active
  heroStage?.pause();

  const wrap = document.getElementById('modal-3d-canvas-wrap');
  const activeColor = getColorById(phone, state.modalColorId);

  if (modalStage) {
    modalStage.dispose();
    modalStage = null;
  }
  modalStage = new Phone3DStage(wrap, {
    initialPhone: phone,
    initialColor: activeColor
  });

  // Reset modal explode slider & camera buttons
  const explodeSlider = document.getElementById('modal-explode-slider');
  explodeSlider.value = '0';
  document.getElementById('modal-explode-val').textContent = '0%';
  document.querySelectorAll('#modal-camera-buttons .dock-mini-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.cam === 'hero');
  });

  renderModalDetails();
}

function close3DModal() {
  const modal = document.getElementById('modal-3d');
  if (modal.hidden) return;
  modal.hidden = true;
  document.body.style.overflow = '';

  if (modalStage) {
    modalStage.dispose();
    modalStage = null;
  }
  heroStage?.resume();
}

function renderModalDetails() {
  const phone = getPhoneById(state.modalPhoneId);
  const color = getColorById(phone, state.modalColorId);
  const storageOpt = getStorageOption(phone, state.modalStorage);

  document.getElementById('modal-3d-brand').textContent = phone.brand;
  document.getElementById('modal-3d-title').textContent = phone.name;
  document.getElementById('modal-3d-color-label').textContent = color.name;
  document.getElementById('modal-3d-tagline').textContent = phone.tagline;
  document.getElementById('modal-3d-price').textContent = formatUZS(storageOpt.price);

  document.getElementById('modal-3d-specs').innerHTML = `
    <div class="modal-spec-row"><span>Ekran</span><strong>${phone.screen}</strong></div>
    <div class="modal-spec-row"><span>Protsessor</span><strong>${phone.chip}</strong></div>
    <div class="modal-spec-row"><span>Kamera</span><strong>${phone.camera}</strong></div>
    <div class="modal-spec-row"><span>Batareya</span><strong>${phone.battery}</strong></div>
  `;

  const swatchesEl = document.getElementById('modal-color-swatches');
  swatchesEl.innerHTML = '';
  phone.colors.forEach((c) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `swatch-btn${c.id === color.id ? ' active' : ''}`;
    btn.style.backgroundColor = c.hex;
    btn.title = c.name;
    btn.setAttribute('aria-label', c.name);
    btn.addEventListener('click', () => {
      state.modalColorId = c.id;
      modalStage?.setColor(c);
      renderModalDetails();
    });
    swatchesEl.appendChild(btn);
  });

  const storageEl = document.getElementById('modal-storage-options');
  storageEl.innerHTML = '';
  phone.storageOptions.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `storage-btn${opt.size === storageOpt.size ? ' active' : ''}`;
    btn.textContent = opt.size;
    btn.addEventListener('click', () => {
      state.modalStorage = opt.size;
      renderModalDetails();
    });
    storageEl.appendChild(btn);
  });
}

function initModalEvents() {
  document.getElementById('close-modal-3d-btn').addEventListener('click', close3DModal);
  document.getElementById('modal-3d').addEventListener('click', (e) => {
    if (e.target.id === 'modal-3d') close3DModal();
  });

  document.getElementById('modal-camera-buttons').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cam]');
    if (!btn || !modalStage) return;
    document.querySelectorAll('#modal-camera-buttons .dock-mini-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    modalStage.setCameraPreset(btn.dataset.cam);
  });

  const explodeSlider = document.getElementById('modal-explode-slider');
  const explodeVal = document.getElementById('modal-explode-val');
  explodeSlider.addEventListener('input', () => {
    const pct = Number(explodeSlider.value);
    explodeVal.textContent = `${pct}%`;
    modalStage?.setExplode(pct / 100);
  });

  document.getElementById('modal-add-to-cart-btn').addEventListener('click', () => {
    const phone = getPhoneById(state.modalPhoneId);
    const color = getColorById(phone, state.modalColorId);
    const storageOpt = getStorageOption(phone, state.modalStorage);
    addToCart(phone, storageOpt.size, color, storageOpt.price);
    close3DModal();
    openCartDrawer();
  });
}

/* =========================================================
   Cart & Telegram Checkout Drawer
   ========================================================= */
function addToCart(phone, storage, color, price) {
  const key = `${phone.id}__${storage}__${color.id}`;
  const existing = state.cart.find((item) => item.key === key);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({
      key,
      phoneId: phone.id,
      name: phone.name,
      brand: phone.brand,
      image: phone.image,
      storage,
      colorId: color.id,
      colorName: color.name,
      price,
      qty: 1
    });
  }
  saveCart();
  renderCart();
  showToast(`${phone.name} (${storage}) savatga qo'shildi`);
}

function updateCartQty(key, delta) {
  const idx = state.cart.findIndex((i) => i.key === key);
  if (idx === -1) return;
  state.cart[idx].qty += delta;
  if (state.cart[idx].qty <= 0) {
    state.cart.splice(idx, 1);
  }
  saveCart();
  renderCart();
}

function removeFromCart(key) {
  state.cart = state.cart.filter((i) => i.key !== key);
  saveCart();
  renderCart();
}

function renderCart() {
  const totalCount = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  document.getElementById('header-cart-count').textContent = String(totalCount);
  document.getElementById('summary-count').textContent = `${totalCount} dona`;
  document.getElementById('summary-total-price').textContent = formatUZS(totalAmount);

  const listEl = document.getElementById('cart-items-list');
  const emptyEl = document.getElementById('cart-empty-state');
  const formEl = document.getElementById('checkout-form');
  const successEl = document.getElementById('order-success-panel');

  if (!successEl.hidden && totalCount === 0) {
    // Keep success receipt visible until user starts a new order
    listEl.innerHTML = '';
    emptyEl.hidden = true;
    formEl.hidden = true;
    return;
  }

  emptyEl.hidden = totalCount > 0;
  formEl.hidden = totalCount === 0;

  listEl.innerHTML = state.cart
    .map(
      (item) => `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.image}" alt="${item.name}" referrerpolicy="no-referrer" />
      <div class="cart-item-info">
        <div class="cart-item-top">
          <h4 class="cart-item-name">${item.name}</h4>
          <button type="button" class="cart-item-remove" data-remove="${item.key}">O'chirish</button>
        </div>
        <div class="cart-item-meta">${item.storage} · ${item.colorName}</div>
        <div class="cart-item-bottom">
          <div class="qty-stepper">
            <button type="button" class="qty-btn" data-qty-dec="${item.key}" aria-label="Kamaytirish">-</button>
            <span class="qty-val tabular-nums">${item.qty}</span>
            <button type="button" class="qty-btn" data-qty-inc="${item.key}" aria-label="Ko'paytirish">+</button>
          </div>
          <strong class="cart-item-price tabular-nums">${formatUZS(item.price * item.qty)}</strong>
        </div>
      </div>
    </div>`
    )
    .join('');
}

function openCartDrawer() {
  document.getElementById('cart-backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
  renderCart();
}

function closeCartDrawer() {
  document.getElementById('cart-backdrop').hidden = true;
  if (document.getElementById('modal-3d').hidden) {
    document.body.style.overflow = '';
  }
}

function initCartAndCheckout() {
  document.getElementById('open-cart-btn').addEventListener('click', openCartDrawer);
  document.getElementById('close-cart-btn').addEventListener('click', closeCartDrawer);
  document.getElementById('cart-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'cart-backdrop') closeCartDrawer();
  });

  document.getElementById('browse-from-cart-btn').addEventListener('click', () => {
    closeCartDrawer();
    document.getElementById('katalog').scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('cart-items-list').addEventListener('click', (e) => {
    const inc = e.target.closest('[data-qty-inc]');
    const dec = e.target.closest('[data-qty-dec]');
    const rem = e.target.closest('[data-remove]');
    if (inc) updateCartQty(inc.dataset.qtyInc, 1);
    if (dec) updateCartQty(dec.dataset.qtyDec, -1);
    if (rem) removeFromCart(rem.dataset.remove);
  });

  const form = document.getElementById('checkout-form');
  const errorBox = document.getElementById('checkout-error-box');
  const submitBtn = document.getElementById('submit-order-btn');
  const successPanel = document.getElementById('order-success-panel');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    errorBox.textContent = '';

    if (state.cart.length === 0) return;

    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const region = document.getElementById('customer-region').value;
    const paymentMethod = document.getElementById('payment-method').value;
    const address = document.getElementById('customer-address').value.trim();
    const note = document.getElementById('order-note').value.trim();

    if (name.length < 2 || phone.length < 7 || address.length < 4) {
      errorBox.textContent = "Iltimos, ism, telefon raqam va manzilni to'liq kiriting.";
      errorBox.hidden = false;
      return;
    }

    const totalAmount = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const orderId = `SM-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const timestamp = now.toLocaleString('uz-UZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const orderPayload = {
      orderId,
      customerName: name,
      phone,
      region,
      address,
      paymentMethod,
      note,
      items: [...state.cart],
      totalAmount,
      timestamp
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Telegramga yuborilmoqda...';

    try {
      await sendOrderToTelegram(orderPayload);

      // Show receipt and clear cart safely
      document.getElementById('success-order-id').textContent = `Buyurtma #${orderId} tasdiqlandi`;
      const receiptBox = document.getElementById('success-receipt-box');
      receiptBox.innerHTML = '';
      const receiptRows = [
        ['Mijoz:', name],
        ['Telefon:', phone],
        ['Manzil:', `${region}, ${address}`],
        ["To'lov:", paymentMethod],
        ['Jami:', formatUZS(totalAmount)]
      ];
      receiptRows.forEach(([label, value]) => {
        const row = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = `${label} `;
        row.appendChild(strong);
        row.appendChild(document.createTextNode(value));
        receiptBox.appendChild(row);
      });

      state.cart = [];
      saveCart();
      form.reset();
      successPanel.hidden = false;
      renderCart();
      showToast(`Buyurtma #${orderId} Telegram kanalga yuborildi`);
    } catch (err) {
      errorBox.textContent = `Telegramga yuborishda xatolik: ${err.message}. Bot kanalda admin ekanligini tekshiring.`;
      errorBox.hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Buyurtma berish va Telegramga yuborish';
    }
  });

  document.getElementById('new-order-btn').addEventListener('click', () => {
    successPanel.hidden = true;
    renderCart();
    closeCartDrawer();
  });
}

/* =========================================================
   Mobile Nav & Global Keyboard Shortcuts
   ========================================================= */
function initNavigation() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');

  menuBtn.addEventListener('click', () => {
    const isHidden = mobileNav.hidden;
    mobileNav.hidden = !isHidden;
    menuBtn.setAttribute('aria-expanded', String(isHidden));
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileNav.hidden = true;
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close3DModal();
      closeCartDrawer();
    }
  });
}

/* =========================================================
   Boot Application
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initHeroStage();
  renderCatalog();
  initCatalogInteractions();
  renderComparisonTable();
  initModalEvents();
  initCartAndCheckout();
  renderCart();
});
