import { Link } from "@tanstack/react-router"
import {
  IconBrandDiscord,
  IconBrandInstagram,
  IconBrandLinkedin,
  IconBrandYoutube,
} from "@tabler/icons-react"
import { CtaButton } from "../components/cta-button"
import { footer, socialLinks } from "../content"
import { appUrl, isAppPath } from "@/lib/app-url"

const socialIcons = {
  youtube: IconBrandYoutube,
  linkedin: IconBrandLinkedin,
  discord: IconBrandDiscord,
  instagram: IconBrandInstagram,
} as const

function FooterLink({ href, label }: { href: string; label: string }) {
  const className =
    "text-sm text-foreground/80 transition-colors hover:text-foreground"

  if (href.startsWith("/#") || href.startsWith("#") || isAppPath(href)) {
    return (
      <a href={isAppPath(href) ? appUrl(href) : href} className={className}>
        {label}
      </a>
    )
  }

  return (
    <Link to={href} className={className}>
      {label}
    </Link>
  )
}

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5 bg-background px-4 pb-10 pt-14 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logo.svg"
              alt=""
              width={32}
              height={28}
              className="relative -top-[5px] h-8 w-9 shrink-0 object-contain"
            />
            <span className="font-display text-base font-semibold text-foreground">
              Sohizi Lab
            </span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {footer.tagline}
          </p>
          <div className="mt-5">
            <CtaButton
              size="sm"
              className="h-9 px-4 text-sm"
              label="Get started"
            />
          </div>
          <div className="mt-6 flex items-center gap-3">
            {socialLinks.map((social) => {
              const Icon = socialIcons[social.network]
              return (
                <a
                  key={social.network}
                  href={social.href}
                  aria-label={social.label}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Icon className="size-5" stroke={1.5} />
                </a>
              )
            })}
          </div>
        </div>

        {footer.columns.map((column) => (
          <div key={column.title}>
            <p className="text-sm font-medium text-muted-foreground">
              {column.title}
            </p>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.label}>
                  <FooterLink href={link.href} label={link.label} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-6xl pt-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Sohizi Lab. All rights reserved.
      </div>
    </footer>
  )
}
