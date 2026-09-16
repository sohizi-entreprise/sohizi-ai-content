import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@sohizi/ui/card"

export function AccountBillingPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan & billing</CardTitle>
        <CardDescription>Manage your subscription and usage</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Plan and billing are coming soon.
        </p>
      </CardContent>
    </Card>
  )
}
