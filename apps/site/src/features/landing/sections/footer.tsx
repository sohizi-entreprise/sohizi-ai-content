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
    href.startsWith("https://") ||
    href.startsWith("http://") ||
    isAppPath(href)
  ) {
    return (
      <a
        href={isAppPath(href) ? appUrl(href) : href}
        className={className}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      >
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
    <footer className="overflow-hidden border-t border-white/10 bg-[#080909] px-4 text-white sm:px-6">
      <div className="mx-auto max-w-[1400px] pt-8 sm:pt-12">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
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
                {column.title === "Legal" ? (
                  <li>
                    <CookieSettingsButton className="text-left text-sm text-white/55 transition-colors duration-200 hover:text-white sm:text-base" />
                  </li>
                ) : null}
              </ul>
              {column.title === "Legal" ? (
                <p className="mt-5 text-xs tracking-wide text-white/30">
                  © {new Date().getFullYear()} Sohizi Lab
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 1200 270"
        preserveAspectRatio="none"
        className="mt-2 block w-full select-none text-white/[0.07]"
      >
        <text
          x="0"
          y="250"
          textLength="1200"
          lengthAdjust="spacingAndGlyphs"
          fill="currentColor"
          fontSize="285"
          className="font-display font-medium"
        >
          Sohizi lab
        </text>
      </svg>
    </footer>
  )
}
