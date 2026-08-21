import { NavLink } from 'react-router-dom'

const ITEMS = [
  {
    to: '/',
    end: true,
    label: 'Mi lista',
    path: 'M6 3h12a1 1 0 011 1v16l-7-4-7 4V4a1 1 0 011-1z',
  },
  {
    to: '/foros',
    label: 'Foros',
    path: 'M4 5h16M4 12h16M4 19h10',
  },
  {
    to: '/buscar',
    label: 'Buscar',
    render: () => (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </>
    ),
  },
  {
    to: '/perfil',
    label: 'Perfil',
    render: () => (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </>
    ),
  },
]

export default function NavBar() {
  return (
    <nav className="flex border-t border-border-subtle bg-bg pt-3" style={{ height: 76 }}>
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1.5 ${isActive ? 'text-accent' : 'text-text-tertiary'}`
          }
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[22px] w-[22px]"
            stroke="currentColor"
            fill="none"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {item.render ? item.render() : <path d={item.path} />}
          </svg>
          <span className="text-[10px] leading-[13px] font-medium">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
