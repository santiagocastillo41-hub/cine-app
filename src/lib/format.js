const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function shortDate(isoString) {
  if (!isoString) return null
  const d = new Date(isoString)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function relativeTime(isoString) {
  if (!isoString) return ''
  const minutes = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000)
  if (minutes < 1) return 'recién'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}
