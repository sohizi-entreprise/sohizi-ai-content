import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@sohizi/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@sohizi/ui/card"
import { Spinner } from "@sohizi/ui/spinner"
import { getInitials } from "../lib"
import { authClient, useSession } from "@/lib/auth-client"

export function AccountProfilePage() {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const user = session?.user

  const handleSignOut = async () => {
    setSigningOut(true)
    await authClient.signOut()
    navigate({ to: "/sign-in" })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your account details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary/20 text-lg font-bold text-primary">
            {getInitials(user?.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">
              {user?.name || "Unnamed"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
        >
          {signingOut && <Spinner />}
          {signingOut ? "Signing out..." : "Sign out"}
        </Button>
      </CardContent>
    </Card>
  )
}
