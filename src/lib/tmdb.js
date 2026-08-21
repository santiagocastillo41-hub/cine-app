const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export function posterUrl(path, size = 'w185') {
  if (!path) return null
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

export function backdropUrl(path, size = 'w780') {
  if (!path) return null
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}
