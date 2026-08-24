// Sin fotos de perfil todavía: un gradiente determinístico por
// username, mismo recurso visual que usan los avatares del mockup.
const PALETTE = [
  ['#3a4a5c', '#1b2530'],
  ['#4a3a3a', '#2a1c1c'],
  ['#3a4a3a', '#1c2a1c'],
  ['#4a3a4a', '#2a1c2a'],
  ['#4a4a3a', '#2a2a1c'],
]

export function avatarGradient(seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  const [from, to] = PALETTE[hash % PALETTE.length]
  return `linear-gradient(140deg, ${from}, ${to})`
}
