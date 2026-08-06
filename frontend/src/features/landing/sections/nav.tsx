import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { CtaButton } from '../components/cta-button'
import { navLinks } from '../content'

function getNavHeight() {
  return window.matchMedia('(min-width: 640px)').matches ? 64 : 56
}

function NavLink({
  href,
  label,
  className,
  onClick,
}: {
  href: string
  label: string
  className?: string
  onClick?: () => void
}) {
  if (href.startsWith('/#') || href.startsWith('#')) {
    return (
      <a href={href} onClick={onClick} className={className}>
        {label}
      </a>
    )
  }

  return (
    <Link to={href} onClick={onClick} className={className}>
      {label}
    </Link>
  )
}

export function LandingNav() {
  const [open, setOpen] = useState(false)
  const [overLight, setOverLight] = useState(false)

  useEffect(() => {
    const targets = document.querySelectorAll('[data-nav-contrast="light"]')
    if (targets.length === 0) return

    const intersecting = new Set<Element>()
    let observer: IntersectionObserver | null = null

    const observe = () => {
      observer?.disconnect()
      intersecting.clear()
      setOverLight(false)

      const navHeight = getNavHeight()
      const bottomMargin = Math.max(0, window.innerHeight - navHeight)

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              intersecting.add(entry.target)
            } else {
              intersecting.delete(entry.target)
            }
          }
          setOverLight(intersecting.size > 0)
        },
        {
          root: null,
          threshold: 0,
          rootMargin: `0px 0px -${bottomMargin}px 0px`,
        },
      )

      targets.forEach((target) => observer?.observe(target))
    }

    observe()
    window.addEventListener('resize', observe)

    return () => {
      window.removeEventListener('resize', observe)
      observer?.disconnect()
    }
  }, [])

  return (
    <header className={cn('backdrop-blur-md transition-colors duration-300')}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo.svg"
            alt=""
            width={32}
            height={28}
            className="h-7 w-8 shrink-0 object-contain sm:h-8 sm:w-9"
          />
          <span
            className={cn(
              'relative top-[5px] font-display text-base font-semibold tracking-tight transition-colors duration-300 sm:text-lg',
              overLight ? 'text-background' : 'text-foreground',
            )}
          >
            Sohizi Lab
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              className={cn(
                'text-sm font-medium transition-all duration-300 hover:scale-105',
                overLight
                  ? 'text-background/80 hover:text-background'
                  : 'text-foreground/80 hover:text-foreground',
              )}
            />
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              'transition-colors duration-300',
              overLight && 'text-background hover:bg-background/10 hover:text-background',
            )}
          >
            <Link to="/sign-in">Sign in</Link>
          </Button>
          <CtaButton size="sm" className="h-9 px-4 text-sm" />
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'md:hidden transition-colors duration-300',
                overLight && 'text-background hover:bg-background/10 hover:text-background',
              )}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(100%,20rem)] border-border bg-background">
            <SheetHeader>
              <SheetTitle className="text-left font-display">Sohizi Lab</SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex flex-col gap-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base text-foreground transition-colors hover:bg-accent"
                />
              ))}
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                <Button asChild variant="outline" className="h-11 justify-center">
                  <Link to="/sign-in" onClick={() => setOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <span onClick={() => setOpen(false)} className="block w-full">
                  <CtaButton className="w-full" />
                </span>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
