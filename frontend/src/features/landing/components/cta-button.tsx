import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CTA_LABEL } from '../content'

type CtaButtonProps = {
  className?: string
  size?: 'default' | 'lg' | 'sm'
  label?: string
}

export function CtaButton({
  className,
  size = 'lg',
  label = CTA_LABEL,
}: CtaButtonProps) {
  return (
    <Button
      asChild
      size={size}
      className={cn(
        'h-11 rounded-lg px-6 text-base font-medium shadow-[var(--shadow-primary)]',
        className,
      )}
    >
      <Link to="/sign-up">{label}</Link>
    </Button>
  )
}
