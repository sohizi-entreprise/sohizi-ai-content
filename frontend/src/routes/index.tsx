import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight text-foreground">
          Sohizi
        </h1>
        <p className="max-w-md text-lg text-muted-foreground">
          AI-powered content creation platform for video storyboarding, scriptwriting, and media production.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link to="/sign-in">Sign In</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/sign-up">Create Account</Link>
        </Button>
      </div>
    </div>
  )
}
