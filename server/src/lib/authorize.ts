import { db } from '@/db'
import { projects, member, conversations, type UserType } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { Forbidden, NotFound } from '@/features/error'

export function assertAdmin(user: { type?: UserType | string | null }) {
  if (user.type !== 'admin') {
    throw new Forbidden('Admin access required')
  }
}

export async function assertOrgMember(userId: string, organizationId: string) {
  const membership = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)))
    .limit(1)

  if (membership.length === 0) {
    throw new Forbidden('Not a member of this organization')
  }
}

export async function assertProjectAccess(userId: string, projectId: string) {
  const project = await db
    .select({ organizationId: projects.organizationId, projectId: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project[0]) {
    throw new NotFound('Project not found')
  }

  await assertOrgMember(userId, project[0].organizationId)
  return project[0]
}

export async function assertConversationOwner(userId: string, conversationId: string) {
  const conversation = await db
    .select({ userId: conversations.userId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)

  if (!conversation[0]) {
    throw new NotFound('Conversation not found')
  }

  if (conversation[0].userId !== userId) {
    throw new Forbidden('You do not own this conversation')
  }
}
