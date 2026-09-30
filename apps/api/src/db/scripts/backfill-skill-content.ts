import { db } from "@/db"
import { fileNodeContents, fileNodes, skills } from "@/db/schema"
import { eq, isNotNull } from "drizzle-orm"
import { serializeSkillDocument } from "@/features/file-system/skill-document"

/**
 * One-shot: copy project skills into file_node_contents and file_nodes.metadata.
 * Run after migration 0038: `bun run src/db/scripts/backfill-skill-content.ts`
 */
async function main() {
  const rows = await db
    .select({
      skill: skills,
    })
    .from(skills)
    .where(isNotNull(skills.fileNodeId))

  let updated = 0
  for (const { skill } of rows) {
    if (!skill.fileNodeId) continue

    const file = await db
      .select()
      .from(fileNodes)
      .where(eq(fileNodes.id, skill.fileNodeId))
      .limit(1)
    const node = file[0]
    if (!node) continue

    const content = serializeSkillDocument({
      description: skill.description,
      instructions: skill.instructions,
    })

    await db
      .insert(fileNodeContents)
      .values({
        fileNodeId: skill.fileNodeId,
        projectId: node.projectId,
        content,
      })
      .onConflictDoUpdate({
        target: fileNodeContents.fileNodeId,
        set: { content },
      })

    await db
      .update(fileNodes)
      .set({
        metadata: {
          ...(node.metadata ?? {}),
          status: skill.status,
          visibility: skill.visibility,
        },
      })
      .where(eq(fileNodes.id, skill.fileNodeId))

    updated += 1
  }

  console.log(`Backfilled ${updated} project skill(s).`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
