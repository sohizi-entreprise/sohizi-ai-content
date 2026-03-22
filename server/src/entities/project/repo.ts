import { db } from "@/db";
import { entities, Entity, projects, scenes, Scene } from "@/db/schema";
import { CreateProject, UpdateProject } from "./model";
import { eq, desc, asc, sql, and, gt, lt } from "drizzle-orm";
import { getSlug } from "@/features/ai/utils";
import { EntityObject } from "zSchemas";
import type { SceneContent } from "@/type";

const ORDER_GAP = 1000;
const DEFAULT_ENTITIES_PAGE_SIZE = 25;

export const createProject = async (data: CreateProject) => {
  const result = await db.insert(projects).values({
    title: data.title,
    brief: data.brief!,
  }).returning();
  return result[0];
}

export const updateProject = async (id: string, data: UpdateProject) => {
  const { status, ...rest } = data;
  const payload = {...rest, ...(status ? {status: status} : {})}
  const result = await db.update(projects).set(payload).where(eq(projects.id, id)).returning();
  return result[0];
}

export const getProjectById = async (id: string) => {
  const result = await db.select().from(projects).where(eq(projects.id, id));
  return result[0];
}

export const listProjects = async () => {
  const result = await db
    .select({
      id: projects.id,
      title: projects.title,
      status: projects.status,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      format: sql<string>`${projects.brief}->>'format'`,
      durationMin: sql<string>`${projects.brief}->>'durationMin'`,
      genre: sql<string>`${projects.brief}->>'genre'`,
    })
    .from(projects)
    .orderBy(desc(projects.createdAt));
  
  return result;
}

export const deleteProject = async (id: string) => {
  const resp = await db.delete(projects).where(eq(projects.id, id)).returning({id: projects.id});
  return resp.length > 0;
}

export const upsertEntities = async (projectId: string, data: EntityObject[], type: Entity['type']) => {
  const entitiesToInsert = data.map(d => ({
    projectId,
    name: d.name,
    slug: getSlug(d.name),
    type,
    metadata: d,
  }))
  const result = await db.insert(entities).values(entitiesToInsert).onConflictDoUpdate({
    target: [entities.projectId, entities.type, entities.slug],
    set: {
      name: sql`excluded.name`,
      metadata: sql`excluded.metadata`,
    },
  }).returning();
  return result;
}

export const cleanAndUpsertEntities = async (projectId: string, data: EntityObject[], type: Entity['type']) => {
  const entitiesToInsert = data.map(d => ({
    projectId,
    name: d.name,
    slug: getSlug(d.name),
    type,
    metadata: d,
  }))
  return db.transaction(async (tx) => {
    await tx.delete(entities).where(and(eq(entities.projectId, projectId), eq(entities.type, type)));

    if (entitiesToInsert.length === 0) {
      return [];
    }

    const result = await tx.insert(entities).values(entitiesToInsert).onConflictDoUpdate({
      target: [entities.projectId, entities.type, entities.slug],
      set: {
        name: sql`excluded.name`,
        metadata: sql`excluded.metadata`,
      },
    }).returning();

    return result;
  });
}

export const updateEntity = async (
  projectId: string,
  entityId: string,
  data: EntityObject
) => {
  const { name } = data;

  const payload: Partial<Entity> = {
    metadata: data,
  }
  if (name !== undefined) {
    payload.name = name;
    payload.slug = getSlug(name);
  }
  
  const result = await db
    .update(entities)
    .set(payload)
    .where(and(eq(entities.projectId, projectId), eq(entities.id, entityId)))
    .returning();
  return result[0];
}

export const getEntityById = async (entityId: string) => {
  const result = await db.select().from(entities).where(eq(entities.id, entityId));
  return result[0];
}

export const listEntities = async (
  projectId: string,
  cursor?: string,
  pageSize = DEFAULT_ENTITIES_PAGE_SIZE,
  entityType?: Entity['type']
) => {
  const rows = await db
    .select()
    .from(entities)
    .where(
      and(
        eq(entities.projectId, projectId),
        ...(entityType ? [eq(entities.type, entityType)] : []),
        ...(cursor ? [lt(entities.createdAt, new Date(cursor))] : [])
      )
    )
    .orderBy(desc(entities.createdAt))
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : undefined;

  return { items, nextCursor, hasMore };
}

export const getEntityBySlug = async (projectId: string, slug: string) => {
  const result = await db.select().from(entities).where(and(eq(entities.projectId, projectId), eq(entities.slug, slug)));
  return result[0];
}

export const createEntity = async (
  projectId: string,
  data: EntityObject,
  type: Entity['type']
) => {
  const result = await db
    .insert(entities)
    .values({
      projectId,
      name: data.name,
      slug: getSlug(data.name),
      type,
      metadata: data,
    })
    .returning();

  return result[0];
}

export const deleteEntity = async (entityId: string) => {
  const result = await db.delete(entities).where(eq(entities.id, entityId)).returning({id: entities.id});
  return result.length > 0;
}


// ---------------------------------------------------------------------------
// Scene Repository
// ---------------------------------------------------------------------------

export const listScenes = async (
  projectId: string,
  cursor?: number,
  pageSize = 25
) => {
  const query = db
    .select()
    .from(scenes)
    .where(
      cursor
        ? and(eq(scenes.projectId, projectId), gt(scenes.order, cursor))
        : eq(scenes.projectId, projectId)
    )
    .orderBy(asc(scenes.order))
    .limit(pageSize + 1);

  const result = await query;
  const hasMore = result.length > pageSize;
  const items = hasMore ? result.slice(0, pageSize) : result;
  const nextCursor = hasMore ? items[items.length - 1]?.order : undefined;

  return { items, nextCursor, hasMore };
};

export const getSceneById = async (sceneId: string) => {
  const result = await db.select().from(scenes).where(eq(scenes.id, sceneId));
  return result[0];
};

export const deleteScene = async (sceneId: string) => {
  const result = await db
    .delete(scenes)
    .where(eq(scenes.id, sceneId))
    .returning({ id: scenes.id });
  return result.length > 0;
};

export const getSceneByIndex = async (projectId: string, index: number) => {
  const result = await db
    .select()
    .from(scenes)
    .where(eq(scenes.projectId, projectId))
    .orderBy(asc(scenes.order))
    .offset(index)
    .limit(1);
  return result[0];
};

export const insertSceneAfter = async (
  projectId: string,
  afterSceneId: string,
  content: SceneContent[]
): Promise<Scene> => {
  const afterScene = await getSceneById(afterSceneId);
  if (!afterScene) throw new Error("Scene not found");

  const nextScene = await db
    .select()
    .from(scenes)
    .where(
      and(
        eq(scenes.projectId, projectId),
        gt(scenes.order, afterScene.order)
      )
    )
    .orderBy(asc(scenes.order))
    .limit(1);

  const nextOrder = nextScene[0]?.order;
  let newOrder: number;

  if (!nextOrder) {
    newOrder = afterScene.order + ORDER_GAP;
  } else if (nextOrder - afterScene.order > 1) {
    newOrder = Math.floor((afterScene.order + nextOrder) / 2);
  } else {
    await renumberScenes(projectId);
    return insertSceneAfter(projectId, afterSceneId, content);
  }

  const result = await db
    .insert(scenes)
    .values({ projectId, order: newOrder, content })
    .returning();
  return result[0];
};

export const createScene = async (projectId: string, content: SceneContent[]) => {
  const lastScene = await db
    .select({ order: scenes.order })
    .from(scenes)
    .where(eq(scenes.projectId, projectId))
    .orderBy(desc(scenes.order))
    .limit(1);

  const newOrder = (lastScene[0]?.order ?? 0) + ORDER_GAP;

  const result = await db
    .insert(scenes)
    .values({ projectId, order: newOrder, content })
    .returning();
  return result[0];
};

export const updateScenes = async (
  updates: { id: string; content: SceneContent[] }[]
) => {
  const results = await Promise.all(
    updates.map((update) =>
      db
        .update(scenes)
        .set({ content: update.content })
        .where(eq(scenes.id, update.id))
        .returning()
    )
  );
  return results.map((r) => r[0]);
};

const renumberScenes = async (projectId: string) => {
  const allScenes = await db
    .select({ id: scenes.id })
    .from(scenes)
    .where(eq(scenes.projectId, projectId))
    .orderBy(asc(scenes.order));

  if (allScenes.length === 0) return;

  const ids = allScenes.map((s) => s.id);
  const caseStatements = allScenes
    .map((scene, index) => `WHEN '${scene.id}' THEN ${(index + 1) * ORDER_GAP}`)
    .join(" ");

  await db.execute(sql`
    UPDATE scenes 
    SET "order" = CASE id ${sql.raw(caseStatements)} END
    WHERE id = ANY(${ids})
  `);
}; 
