import { Elysia } from 'elysia'
import { auth } from './auth'
import { Unauthorized } from '@/features/error'

export const authMiddleware = new Elysia({ name: 'auth-middleware' }).derive(
  { as: 'scoped' },
  async ({ request: { headers } }) => {
    const session = await auth.api.getSession({ headers })
    if (!session) {
      throw new Unauthorized('Authentication required')
    }
    return {
      user: session.user,
      session: session.session,
    }
  },
)
