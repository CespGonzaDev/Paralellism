// Elementos del DOM
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const gamesGrid = document.getElementById('gamesGrid');
const resultsCount = document.getElementById('resultsCount');
const emptyState = document.getElementById('emptyState');
const errorState = document.getElementById('errorState');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModal');
const modalOverlay = modal.querySelector('.modal-overlay');

// Estado
let allGames = [];
let filteredGames = [];

// Detectar plataforma desde la URL
function detectPlatform(url) {
  if (!url) return 'PC';
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('steam') || lowerUrl.includes('pc')) return '🖥️ PC';
  if (lowerUrl.includes('playstation') || lowerUrl.includes('ps')) return '🎮 PlayStation';
  if (lowerUrl.includes('xbox')) return '🎮 Xbox';
  if (lowerUrl.includes('switch')) return '🎮 Switch';
  return '🖥️ PC';
}

// Normalizar datos del JSON
function normalizeGame(rawGame) {
  const stores = rawGame.Tiendas || {};
  const offers = Object.entries(stores)
    .map(([key, store]) => ({
      storeKey: key,
      storeName: store.StoreName,
      url: store.Url || null,
      price: typeof store.PriceNumber === 'number' ? store.PriceNumber : null,
      priceRaw: store.PriceRaw || null
    }))
    .filter(offer => offer.price !== null);

  const bestOffer = offers.length > 0 
    ? offers.sort((a, b) => a.price - b.price)[0] 
    : null;

  // Extraer precio original del PriceRaw
  let regularPrice = null;
  if (bestOffer && offers.length > 0) {
    const raw = offers.find(o => o.priceRaw)?.priceRaw || '';
    // Extraer todos los números del string (ej: "$14.99$13.49" -> [14.99, 13.49])
    const numbers = (raw.match(/[\d.]+/g) || [])
      .map(Number)
      .sort((a, b) => b - a); // Ordenar de mayor a menor
    // El precio original es el mayor que sea diferente al precio actual
    regularPrice = numbers.find(n => n > bestOffer.price) ?? null;
  }

  const discountPercent = (bestOffer && regularPrice)
    ? Math.round((1 - bestOffer.price / regularPrice) * 100)
    : null;

  const platform = detectPlatform(rawGame.FuenteInicialUrl);

  return {
    id: rawGame.Nombre,
    title: rawGame.Nombre,
    coverUrl: rawGame.ImagenUrl || '',
    rating: rawGame.Analisis?.Calificacion ?? null,
    avgHours: rawGame.Analisis?.HorasPromedio ?? null,
    reviewCount: rawGame.Analisis?.CantidadResenas ?? null,
    sourceUrl: rawGame.FuenteInicialUrl || null,
    platform,
    offers,
    bestOffer,
    regularPrice,
    discountPercent
  };
}

// Renderizar juegos
function renderGames(games) {
  if (games.length === 0) {
    gamesGrid.innerHTML = '';
    emptyState.style.display = 'block';
    errorState.style.display = 'none';
    resultsCount.textContent = '';
    return;
  }

  emptyState.style.display = 'none';
  errorState.style.display = 'none';

  gamesGrid.innerHTML = games.map(game => `
    <div class="game-card" data-game-id="${game.id}">
      <div style="position: relative;">
        <img 
          class="game-card-image" 
          src="${game.coverUrl}" 
          alt="${game.title}"
          onerror="this.style.opacity='0.3'"
        >
        <div class="game-card-badges">
          ${game.discountPercent ? `<div class="discount-badge">-${game.discountPercent}%</div>` : ''}
          ${game.rating ? `<div class="rating-badge">⭐ ${game.rating}</div>` : ''}
        </div>
      </div>
      <div class="game-card-body">
        <h3 class="game-card-title">${game.title}</h3>
        <div class="game-card-platform">${game.platform}</div>
        <div class="game-card-pricing">
          <div class="price-row">
            <span class="price-current">
              ${game.bestOffer ? '$' + game.bestOffer.price.toFixed(2) : 'N/D'}
            </span>
            ${game.regularPrice ? `<span class="price-original">$${game.regularPrice.toFixed(2)}</span>` : ''}
          </div>
        </div>
      </div>
    </div>
  `).join('');

  resultsCount.textContent = `Mostrando ${games.length} juego${games.length !== 1 ? 's' : ''}`;
}

// Filtrar juegos
function filterGames() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  
  filteredGames = allGames.filter(game =>
    game.title.toLowerCase().includes(searchTerm)
  );
  
  sortGames();
}

// Ordenar juegos
function sortGames() {
  const sortBy = sortSelect.value;
  
  switch (sortBy) {
    case 'name':
      filteredGames.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'priceAsc':
      filteredGames.sort((a, b) => 
        (a.bestOffer?.price ?? Infinity) - (b.bestOffer?.price ?? Infinity)
      );
      break;
    case 'priceDesc':
      filteredGames.sort((a, b) => 
        (b.bestOffer?.price ?? 0) - (a.bestOffer?.price ?? 0)
      );
      break;
    case 'ratingDesc':
      filteredGames.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case 'discountDesc':
      filteredGames.sort((a, b) => 
        (b.discountPercent ?? 0) - (a.discountPercent ?? 0)
      );
      break;
  }
  
  renderGames(filteredGames);
}

// Cargar juegos desde Firebase
async function loadGames() {
  resultsCount.textContent = 'Cargando...';
  gamesGrid.innerHTML = '';
  emptyState.style.display = 'none';
  errorState.style.display = 'none';
  
  try {
    const firebaseUrl = 'https://resultadosscrapping-default-rtdb.firebaseio.com/resultados.json';
    const response = await fetch(firebaseUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const rawData = await response.json();
    allGames = rawData.map(normalizeGame);
    filteredGames = [...allGames];
    sortGames();
  } catch (error) {
    console.error('Error cargando los juegos:', error);
    gamesGrid.innerHTML = '';
    emptyState.style.display = 'none';
    errorState.style.display = 'block';
    resultsCount.textContent = '';
  }
}

// Mostrar modal
function showModal(game) {
  modalBody.innerHTML = `
    <img class="modal-image" src="${game.coverUrl}" alt="${game.title}" onerror="this.style.display='none'">
    <div class="modal-details">
      <h2>${game.title}</h2>
      <p><strong>Plataforma:</strong> ${game.platform}</p>
      <p><strong>Calificación:</strong> ${game.rating ? '⭐ ' + game.rating : '—'}</p>
      <p><strong>Horas Promedio:</strong> ${game.avgHours ?? '—'}</p>
      <p><strong>Cantidad de Reseñas:</strong> ${game.reviewCount ? game.reviewCount.toLocaleString() : '—'}</p>
      <p><strong>Mejor Precio:</strong> ${game.bestOffer ? '$' + game.bestOffer.price.toFixed(2) : '—'}</p>
      <p><strong>Precio Original:</strong> ${game.regularPrice ? '$' + game.regularPrice.toFixed(2) : '—'}</p>
      ${game.discountPercent ? `<p><strong>Descuento:</strong> <span style="color: var(--success)">-${game.discountPercent}%</span></p>` : ''}
      
      <h3>Ofertas Disponibles</h3>
      <table class="offers-table">
        <thead>
          <tr>
            <th>Tienda</th>
            <th>Precio</th>
            <th>Descuento</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          ${game.offers.map(offer => `
            <tr>
              <td>${offer.storeName}</td>
              <td>${offer.price ? '$' + offer.price.toFixed(2) : '—'}</td>
              <td>${game.regularPrice && offer.price 
                ? Math.round((1 - offer.price / game.regularPrice) * 100) + '%' 
                : '—'}</td>
              <td>${offer.url ? `<a href="${offer.url}" target="_blank" rel="noopener">Visitar ➜</a>` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      ${game.sourceUrl ? `<a href="${game.sourceUrl}" target="_blank" rel="noopener" style="color: var(--accent);">Ver en Steam ➜</a>` : ''}
    </div>
  `;
  
  modal.style.display = 'flex';
}

// Cerrar modal
function closeModal() {
  modal.style.display = 'none';
}

// Event listeners
searchInput.addEventListener('input', filterGames);
sortSelect.addEventListener('change', sortGames);

gamesGrid.addEventListener('click', (e) => {
  const card = e.target.closest('.game-card');
  if (!card) return;
  
  const gameId = card.dataset.gameId;
  const game = filteredGames.find(g => g.id === gameId);
  
  if (game) {
    showModal(game);
  }
});

closeModalBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.style.display === 'flex') {
    closeModal();
  }
});

// Inicializar
loadGames();
