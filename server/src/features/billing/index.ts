import { Elysia } from 'elysia'
import { z } from 'zod'
import { authMiddleware } from '@/lib/auth-middleware'
import { assertOrgMember } from '@/lib/authorize'
import { BadRequest } from '@/features/error'
import { billingService } from './service'

export const billingRoutes = new Elysia({ prefix: '/billing' })
  .use(authMiddleware)
  .get('/balance', async ({ session, user, query }) => {
    const organizationId = query.organizationId ?? session.activeOrganizationId
    if (!organizationId) {
      throw new BadRequest('No active organization. Please select an organization first.')
    }
    await assertOrgMember(user.id, organizationId)
    const balance = await billingService.getBalance(organizationId)
    return {
      organizationId,
      balance: balance.toString(),
      currency: 'credits' as const,
    }
  }, {
    query: z.object({
      organizationId: z.string().optional(),
    }),
  })

export { billingService, BillingService } from './service'
export * from './types'
export * from './errors'
export * from './constants'
export * from './credits'
export { withBilling, withBillingAsync, withBillingStream } from './wrapper'
export type { AsyncReservationHandle, WithBillingCallContext } from './wrapper'
