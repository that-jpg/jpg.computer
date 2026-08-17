export interface NavLink {
  href: string
  label: string
}

export const NAV_LINKS: NavLink[] = [
  { href: '/ub/', label: 'all' },
  { href: '/ub/boards/', label: 'boards' },
  { href: '/ub/metrics/', label: 'metrics' },
  { href: '/ub/calendar/', label: 'calendar' },
  { href: '/ub/fisica3/', label: 'física 3' },
]

export function HeaderNav({
  title,
  current,
  links = NAV_LINKS,
  showLogout,
  onLogout,
}: {
  title: string
  current: string
  links?: NavLink[]
  showLogout: boolean
  onLogout: () => void
}) {
  return (
    <header>
      <h1>ub <em>{title}</em></h1>
      <nav id="header-nav">
        {links.map(link => (
          <a key={link.href} href={link.href} className={link.label === current ? 'here' : undefined}>
            {link.label}
          </a>
        ))}
        <button id="logout" className={showLogout ? undefined : 'hidden'} onClick={onLogout}>
          logout
        </button>
      </nav>
    </header>
  )
}
