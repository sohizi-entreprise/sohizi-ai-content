import { CookieSettingsButton } from "@sohizi/analytics/consent"
import { Link } from "@tanstack/react-router"
import { footer } from "../content"
import { appUrl, isAppPath } from "@/lib/app-url"

function FooterLink({ href, label }: { href: string; label: string }) {
  const className =
    "text-sm text-white/55 transition-colors duration-200 hover:text-white sm:text-base"

  if (
    href.startsWith("/#") ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    isAppPath(href)
  ) {
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
    <footer className="bg-[#080909] px-4 pb-8 text-white sm:px-6">
      <div className="mx-auto max-w-[1400px] pt-8 sm:pt-12">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.7fr)_repeat(3,minmax(0,.7fr))] lg:gap-12">
          <div>
            <p className="max-w-sm font-display text-2xl leading-tight tracking-tight text-white/75 sm:text-3xl">
              {footer.tagline}
            </p>
          </div>
          {footer.columns.map((column) => (
            <div key={column.title}>
              <p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-white/35">
                {column.title}
              </p>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink href={link.href} label={link.label} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-20 flex flex-col justify-between gap-3 pt-6 text-xs text-white/40 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()}. All rights reserved.</span>
          <CookieSettingsButton className="w-fit text-white/50 underline decoration-white/30 underline-offset-4 transition hover:text-white" />
        </div>
      </div>
    </footer>
  )
}
