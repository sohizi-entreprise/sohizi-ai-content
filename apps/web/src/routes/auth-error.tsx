import { Link, createFileRoute, useSearch } from "@tanstack/react-router"
import { Button } from "@sohizi/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@sohizi/ui/card"

const ERROR_MESSAGES: Record<
  string,
  { title: string; description: string } | undefined
> = {
  account_not_linked: {
    title: "Account Already Exists",
    description:
      "This email is already registered with a different sign-in method. Please sign in using the method you originally used.",
  },
  unable_to_create_user: {
    title: "Account Creation Failed",
    description:
      "We were unable to create your account. Please try again or use a different sign-in method.",
  },
  state_not_found: {
    title: "Session Expired",
    description:
      "Your authentication session has expired. This usually happens if you took too long to complete the sign-in. Please try again.",
  },
  no_code: {
    title: "Authentication Incomplete",
    description:
      "The sign-in provider did not return the required authorization. Please try again.",
  },
  invalid_code: {
    title: "Invalid Authorization",
    description:
      "The authorization code was invalid or has expired. Please try signing in again.",
  },
  unable_to_get_user_info: {
    title: "Profile Unavailable",
    description:
      "We could not retrieve your profile information from the sign-in provider. Please try again or use a different method.",
  },
  access_denied: {
    title: "Access Denied",
    description:
      "You denied permission to access your account. To sign in, you need to grant the required permissions.",
  },
}

const DEFAULT_ERROR = {
  title: "Authentication Error",
  description: "Something went wrong during sign-in. Please try again.",
}

export const Route = createFileRoute("/auth-error")({
  validateSearch: (search: Record<string, unknown>) => ({
    error: (search.error as string) || "unknown",
  }),
  component: AuthErrorPage,
})

function AuthErrorPage() {
  const { error } = useSearch({ from: "/auth-error" })
  const errorInfo = ERROR_MESSAGES[error] || DEFAULT_ERROR

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{errorInfo.title}</CardTitle>
          <CardDescription>{errorInfo.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {error !== "unknown" && (
            <p className="text-center text-xs text-muted-foreground">
              Error code: {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button
            asChild
            className="w-full"
          >
            <Link to="/sign-in">Try Again</Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="w-full"
          >
            <Link to="/">Back to Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
