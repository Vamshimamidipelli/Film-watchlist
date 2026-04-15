const API_KEY = 'aeb6e994';
const API_URL = 'https://www.omdbapi.com/';
const WATCHLIST_KEY = 'movieSuggestionWatchlist';
const SEARCH_SESSION_KEY = 'movieSuggestionSearchResults';
const SEARCH_QUERY_KEY = 'movieSuggestionSearchQuery';
const searchForm = document.querySelector('.search-form');
const searchInput = document.querySelector('#movie-search');
const resultsSection = document.getElementById('results');
const movieList = document.getElementById('movie-list');
const emptyState = document.getElementById('empty-state');
const emptyStateText = emptyState?.querySelector('p');
const ratingFilterInput = document.querySelector('#high-rating-filter');
const isWatchlistPage = window.location.pathname.includes('watchlist.html');
let currentSearchResults = [];
let filterByHighRating = false;
let searchDebounceTimeout;

const placeholderPoster = 'https://unsplash.com/photos/THJJRUhNlEc';

function debounceSearch(callback, delay = 800) {
  return function(...args) {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => callback(...args), delay);
  };
}

function setEmptyMessage(message) {
  if (emptyStateText) {
    emptyStateText.textContent = message;
  }
}

function toggleSections(showResults) {
  if (showResults) {
    resultsSection?.classList.remove('hidden');
    emptyState?.classList.add('hidden');
  } else {
    resultsSection?.classList.add('hidden');
    emptyState?.classList.remove('hidden');
  }
}

function saveSearchResults(results, query) {
  sessionStorage.setItem(SEARCH_SESSION_KEY, JSON.stringify(results));
  sessionStorage.setItem(SEARCH_QUERY_KEY, query || '');
}

function loadSearchResults() {
  const data = sessionStorage.getItem(SEARCH_SESSION_KEY);
  if (!data) return false;

  try {
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    currentSearchResults = parsed;
    const savedQuery = sessionStorage.getItem(SEARCH_QUERY_KEY) || '';
    if (searchInput) searchInput.value = savedQuery;
    renderMovies(parsed);
    toggleSections(true);
    return true;
  } catch {
    return false;
  }
}

function clearSearchResults() {
  sessionStorage.removeItem(SEARCH_SESSION_KEY);
  sessionStorage.removeItem(SEARCH_QUERY_KEY);
}

function getWatchlist() {
  const stored = localStorage.getItem(WATCHLIST_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) || [];
  } catch {
    return [];
  }
}

function saveWatchlist(list) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
}

function isMovieSaved(imdbID) {
  return getWatchlist().some(movie => movie.imdbID === imdbID);
}

function addMovieToWatchlist(movie) {
  const list = getWatchlist();
  if (!list.some(item => item.imdbID === movie.imdbID)) {
    list.unshift(movie);
    saveWatchlist(list);
  }
}

function removeMovieFromWatchlist(imdbID) {
  const updated = getWatchlist().filter(movie => movie.imdbID !== imdbID);
  saveWatchlist(updated);
  return updated;
}

function applyRatingFilter(movies) {
  if (!filterByHighRating) return movies;
  return movies.filter(movie => {
    const rating = parseFloat(movie.imdbRating);
    return !isNaN(rating) && rating >= 7;
  });
}

function sortMoviesByRating(movies) {
  return [...movies].sort((a, b) => {
    const ratingA = parseFloat(a.imdbRating) || 0;
    const ratingB = parseFloat(b.imdbRating) || 0;
    return ratingB - ratingA;
  });
}

async function fetchMovies(query) {
  const url = `${API_URL}?apikey=${API_KEY}&s=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  return response.json();
}

async function fetchMovieDetails(imdbID) {
  const url = `${API_URL}?apikey=${API_KEY}&i=${imdbID}&plot=short`;
  const response = await fetch(url);
  return response.json();
}

function renderMovies(movies) {
  movieList.innerHTML = movies
    .map(movie => {
      const poster = movie.Poster && movie.Poster !== 'N/A' ? movie.Poster : placeholderPoster;
      const runtime = movie.Runtime && movie.Runtime !== 'N/A' ? movie.Runtime : 'Unknown';
      const genre = movie.Genre && movie.Genre !== 'N/A' ? movie.Genre : 'Unknown';
      const rating = movie.imdbRating && movie.imdbRating !== 'N/A' ? movie.imdbRating : '--';
      const plot = movie.Plot && movie.Plot !== 'N/A' ? movie.Plot : 'No overview available.';
      const saved = isMovieSaved(movie.imdbID);
      const action = saved ? 'remove' : 'add';
      const label = saved ? 'Remove' : '+ Watchlist';
      const extraClass = saved ? ' remove' : '';

      return `
      <article class="movie-card">
        <img class="movie-card__poster" src="${poster}" alt="${movie.Title} poster" />
        <div class="movie-card__body">
          <div class="movie-card__header">
            <h2 class="movie-card__title">${movie.Title}</h2>
            <span class="movie-card__rating">★ ${rating}</span>
          </div>
          <div class="movie-card__meta">
            <span>${runtime}</span>
            <span>${genre}</span>
          </div>
          <p class="movie-card__overview">${plot}</p>
          <button
            type="button"
            class="movie-card__watchlist${extraClass}"
            data-id="${movie.imdbID}"
            data-action="${action}"
          >${label}</button>
        </div>
      </article>`;
    })
    .join('');
}

function updateDisplay(movies, emptyMessage = 'No movies found') {
  currentSearchResults = movies;
  const sorted = sortMoviesByRating(movies);
  const filtered = applyRatingFilter(sorted);

  if (filtered.length > 0) {
    renderMovies(filtered);
    toggleSections(true);
  } else {
    setEmptyMessage(filterByHighRating ? 'No high-rated movies found' : emptyMessage);
    toggleSections(false);
  }
}

function renderWatchlist(displayMovies = null) {
  const saved = displayMovies !== null ? displayMovies : getWatchlist();
  if (saved.length > 0) {
    updateDisplay(saved, 'Your watchlist is empty');
  } else {
    setEmptyMessage('Your watchlist is empty');
    toggleSections(false);
    currentSearchResults = [];
  }
}

function updateSavedButton(button) {
  if (!button) return;
  button.textContent = 'Saved';
  button.classList.add('saved');
  button.disabled = true;
}

movieList?.addEventListener('click', event => {
  const button = event.target.closest('.movie-card__watchlist');
  if (!button) return;

  const imdbID = button.dataset.id;
  const action = button.dataset.action;
  if (!imdbID || !action) return;

  if (action === 'add') {
    const movie = currentSearchResults.find(item => item.imdbID === imdbID);
    if (!movie) return;
    addMovieToWatchlist(movie);

    if (isWatchlistPage) {
      renderWatchlist();
      return;
    }

    button.dataset.action = 'remove';
    button.textContent = 'Remove';
    button.classList.add('remove');
    button.classList.remove('saved');
    saveSearchResults(currentSearchResults, searchInput?.value.trim() || '');
    return;
  }

  if (action === 'remove') {
    const movieCard = button.closest('.movie-card');
    const finalizeRemoval = () => {
      removeMovieFromWatchlist(imdbID);
      if (isWatchlistPage) {
        currentSearchResults = currentSearchResults.filter(item => item.imdbID !== imdbID);
        renderWatchlist(currentSearchResults);
      } else {
        updateDisplay(currentSearchResults.filter(item => item.imdbID !== imdbID), 'No movies found');
        saveSearchResults(currentSearchResults, searchInput?.value.trim() || '');
      }
    };

    if (movieCard) {
      movieCard.classList.add('deleting');
      setTimeout(finalizeRemoval, 500);
    } else {
      finalizeRemoval();
    }
  }
});

searchForm?.addEventListener('submit', async event => {
  event.preventDefault();
  await performSearch();
});

async function performSearch() {
  const query = searchInput?.value.trim();
  if (!query) {
    if (isWatchlistPage) {
      const saved = getWatchlist();
      const sorted = sortMoviesByRating(saved);
      updateDisplay(sorted, filterByHighRating ? 'No high-rated movies in your watchlist' : 'Your watchlist is empty');
      return;
    }

    setEmptyMessage('Type a movie name to search.');
    toggleSections(false);
    return;
  }

  if (isWatchlistPage) {
    const saved = getWatchlist();
    const filtered = saved.filter(movie => {
      const text = query.toLowerCase();
      return (
        movie.Title.toLowerCase().includes(text) ||
        movie.Genre.toLowerCase().includes(text) ||
        movie.Plot.toLowerCase().includes(text) ||
        String(movie.imdbRating).toLowerCase().includes(text)
      );
    });

    currentSearchResults = filtered;
    updateDisplay(filtered, 'No movies found in your watchlist');
    return;
  }

  setEmptyMessage('Searching...');
  toggleSections(false);

  try {
    const searchData = await fetchMovies(query);

    if (searchData.Response === 'True') {
      const details = await Promise.all(
        searchData.Search.slice(0, 8).map(movie => fetchMovieDetails(movie.imdbID))
      );

      currentSearchResults = details;
      updateDisplay(details, searchData.Error || 'No results found');
      saveSearchResults(details, query);
    } else {
      setEmptyMessage(searchData.Error || 'No results found');
      toggleSections(false);
      clearSearchResults();
    }
  } catch (error) {
    console.error('Fetch failed:', error);
    setEmptyMessage('Unable to fetch movies right now.');
    toggleSections(false);
  }
}

const debouncedSearch = debounceSearch(performSearch, 800);

searchInput?.addEventListener('input', () => {
  debouncedSearch();
});

ratingFilterInput?.addEventListener('change', event => {
  filterByHighRating = event.target.checked;
  if (isWatchlistPage && currentSearchResults.length === 0) {
    const saved = getWatchlist();
    currentSearchResults = sortMoviesByRating(saved);
  }

  const sorted = sortMoviesByRating(currentSearchResults);
  const filtered = applyRatingFilter(sorted);
  if (filtered.length > 0) {
    renderMovies(filtered);
    toggleSections(true);
  } else {
    setEmptyMessage(isWatchlistPage ? 'No high-rated movies in your watchlist' : 'No high-rated movies found');
    toggleSections(false);
  }
});

document.querySelectorAll('.watchlist-btn').forEach(btn => {
  btn.addEventListener('click', event => {
    event.preventDefault();
    const href = btn.getAttribute('href');
    if (!href) return;
    
    btn.classList.add('navigating');
    setTimeout(() => {
      window.location.href = href;
    }, 300);
  });
});

if (isWatchlistPage) {
  renderWatchlist();
} else {
  if (!loadSearchResults()) {
    toggleSections(false);
  } else {
    updateDisplay(currentSearchResults, 'No movies found');
  }
}

const offlineBanner = document.getElementById('offline-banner');

function updateOfflineBanner() {
  if (!navigator.onLine) {
    offlineBanner.style.display = 'block';
    document.body.classList.add('offline');
  } else {
    offlineBanner.style.display = 'none';
    document.body.classList.remove('offline');
  }
}

// Check initial online status
updateOfflineBanner();

// Listen for online/offline events
window.addEventListener('online', updateOfflineBanner);
window.addEventListener('offline', updateOfflineBanner);
