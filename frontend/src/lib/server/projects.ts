import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  projects,
  projectBriefs,
  outlineActs,
  scenes,
  characters,
  locations,
  props,
  costumes,
  shots,
  shotImages,
} from '@/db/schema'
import {
  createProjectSchema,
  updateOutlineSchema,
  type CreateProjectInput,
  type UpdateOutlineInput,
  type ProjectWithDetails,
  type StoryboardScene,
  type ProjectEntities,
  type ShotWithImage,
} from '@/lib/types'

// Get all projects
export const getProjects = createServerFn().handler(async () => {
  const result = await db
    .select()
    .from(projects)
    .orderBy(projects.createdAt)

  return result.map((p) => ({
    ...p,
    format: p.format as 'storytime' | 'explainer' | 'documentary' | 'presenter',
    status: p.status as
      | 'DRAFT'
      | 'OUTLINE_GENERATED'
      | 'OUTLINE_CONFIRMED'
      | 'SHOTS_GENERATED',
  }))
})

// Get single project with details
export const getProject = createServerFn().handler(
  async (ctx: { data: { projectId: string } }): Promise<ProjectWithDetails | null> => {
    const { projectId } = ctx.data

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))

    if (!project) return null

    const [brief] = await db
      .select()
      .from(projectBriefs)
      .where(eq(projectBriefs.projectId, projectId))

    const acts = await db
      .select()
      .from(outlineActs)
      .where(eq(outlineActs.projectId, projectId))
      .orderBy(outlineActs.order)

    const projectScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.projectId, projectId))
      .orderBy(scenes.order)

    return {
      id: project.id,
      name: project.name,
      format: project.format as ProjectWithDetails['format'],
      status: project.status as ProjectWithDetails['status'],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      brief: brief
        ? {
            id: brief.id,
            title: brief.title,
            logline: brief.logline,
            audience: brief.audience as NonNullable<
              ProjectWithDetails['brief']
            >['audience'],
            tone: brief.tone,
            genre: brief.genre,
            constraints: brief.constraints as NonNullable<
              ProjectWithDetails['brief']
            >['constraints'],
          }
        : undefined,
      acts: acts.map((a) => ({
        id: a.id,
        actId: a.actId,
        order: a.order,
        title: a.title,
        summary: a.summary,
        goals: (a.goals as string[]) || [],
        turningPoints: (a.turningPoints as string[]) || [],
        sceneIds: (a.sceneIds as string[]) || [],
      })),
      scenes: projectScenes.map((s) => ({
        id: s.id,
        sceneId: s.sceneId,
        actId: s.actId,
        order: s.order,
        title: s.title,
        summary: s.summary,
        mood: s.mood,
        timeOfDay: (s.timeOfDay || 'unspecified') as StoryboardScene['timeOfDay'],
        locationRef: s.locationRef,
      })),
    }
  }
)

// Create project
export const createProject = createServerFn().handler(
  async (ctx: { data: CreateProjectInput }) => {
    const data = createProjectSchema.parse(ctx.data)

    const [project] = await db
      .insert(projects)
      .values({
        name: data.name,
        format: data.format,
        status: 'DRAFT',
      })
      .returning()

    return { projectId: project.id }
  }
)

// Update outline
export const updateOutline = createServerFn().handler(
  async (ctx: { data: { projectId: string } & UpdateOutlineInput }) => {
    const validated = updateOutlineSchema.parse(ctx.data)
    const { projectId } = ctx.data
    const { projectBrief: briefData, acts: actsData, scenes: scenesData } = validated

    // Update brief if provided
    if (briefData) {
      const [existingBrief] = await db
        .select()
        .from(projectBriefs)
        .where(eq(projectBriefs.projectId, projectId))

      if (existingBrief) {
        await db
          .update(projectBriefs)
          .set({
            title: briefData.title,
            logline: briefData.logline,
            audience: briefData.audience,
            tone: briefData.tone,
            genre: briefData.genre,
            stylePackId: briefData.stylePackId,
            constraints: briefData.constraints,
            updatedAt: new Date(),
          })
          .where(eq(projectBriefs.id, existingBrief.id))
      } else {
        await db.insert(projectBriefs).values({
          projectId,
          title: briefData.title,
          logline: briefData.logline,
          audience: briefData.audience,
          tone: briefData.tone,
          genre: briefData.genre,
          stylePackId: briefData.stylePackId,
          constraints: briefData.constraints,
        })
      }
    }

    // Update acts if provided
    if (actsData) {
      // Delete existing acts
      await db.delete(outlineActs).where(eq(outlineActs.projectId, projectId))

      // Insert new acts
      if (actsData.length > 0) {
        await db.insert(outlineActs).values(
          actsData.map((act, index) => ({
            projectId,
            actId: act.actId,
            order: index,
            title: act.title,
            summary: act.summary,
            goals: act.goals,
            turningPoints: act.turningPoints,
            sceneIds: act.sceneIds,
          }))
        )
      }
    }

    // Update scenes if provided
    if (scenesData) {
      // Delete existing scenes
      await db.delete(scenes).where(eq(scenes.projectId, projectId))

      // Insert new scenes
      if (scenesData.length > 0) {
        await db.insert(scenes).values(
          scenesData.map((scene) => ({
            projectId,
            sceneId: scene.sceneId,
            actId: scene.actId,
            order: scene.order,
            title: scene.title,
            summary: scene.summary,
            mood: scene.mood,
            timeOfDay: scene.timeOfDay,
            locationRef: scene.locationHint,
          }))
        )
      }
    }

    // Update project status
    await db
      .update(projects)
      .set({ status: 'OUTLINE_CONFIRMED', updatedAt: new Date() })
      .where(eq(projects.id, projectId))

    return { ok: true }
  }
)

// Get storyboard data
export const getStoryboard = createServerFn().handler(
  async (ctx: {
    data: { projectId: string }
  }): Promise<{ scenes: StoryboardScene[]; entities: ProjectEntities } | null> => {
    const { projectId } = ctx.data

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))

    if (!project) return null

    // Get scenes
    const projectScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.projectId, projectId))
      .orderBy(scenes.order)

    // Get shots for each scene
    const scenesWithShots: StoryboardScene[] = await Promise.all(
      projectScenes.map(async (scene) => {
        const sceneShots = await db
          .select()
          .from(shots)
          .where(eq(shots.sceneDbId, scene.id))
          .orderBy(shots.order)

        // Get images for shots
        const shotsWithImages: ShotWithImage[] = await Promise.all(
          sceneShots.map(async (shot) => {
            const [image] = await db
              .select()
              .from(shotImages)
              .where(eq(shotImages.shotDbId, shot.id))
              .orderBy(shotImages.createdAt)

            return {
              id: shot.id,
              shotId: shot.shotId,
              sceneDbId: shot.sceneDbId,
              order: shot.order,
              shotType: (shot.shotType || 'medium') as ShotWithImage['shotType'],
              angle: (shot.angle || 'eye_level') as ShotWithImage['angle'],
              lens: shot.lens,
              movement: (shot.movement || 'static') as ShotWithImage['movement'],
              visualSummary: shot.visualSummary,
              composition: shot.composition,
              action: shot.action,
              moodKeywords: (shot.moodKeywords as string[]) || [],
              entitiesInShot: shot.entitiesInShot as ShotWithImage['entitiesInShot'],
              spoken: (shot.spoken as ShotWithImage['spoken']) || [],
              constraints: shot.constraints as ShotWithImage['constraints'],
              image: image
                ? {
                    id: image.id,
                    imageUrl: image.imageUrl,
                    prompt: image.prompt,
                    seed: image.seed,
                  }
                : undefined,
            }
          })
        )

        return {
          id: scene.id,
          sceneId: scene.sceneId,
          order: scene.order,
          title: scene.title,
          summary: scene.summary,
          mood: scene.mood,
          timeOfDay: (scene.timeOfDay ||
            'unspecified') as StoryboardScene['timeOfDay'],
          locationRef: scene.locationRef,
          shots: shotsWithImages,
        }
      })
    )

    // Get entities
    const projectCharacters = await db
      .select()
      .from(characters)
      .where(eq(characters.projectId, projectId))

    const projectLocations = await db
      .select()
      .from(locations)
      .where(eq(locations.projectId, projectId))

    const projectProps = await db
      .select()
      .from(props)
      .where(eq(props.projectId, projectId))

    const projectCostumes = await db
      .select()
      .from(costumes)
      .where(eq(costumes.projectId, projectId))

    const entities: ProjectEntities = {
      characters: projectCharacters.map((c) => ({
        id: c.id,
        characterId: c.characterId,
        name: c.name,
        role: (c.role || 'unknown') as ProjectEntities['characters'][0]['role'],
        description: c.description,
        lockedTraits: (c.lockedTraits as string[]) || [],
        defaultCostumeId: c.defaultCostumeId,
      })),
      locations: projectLocations.map((l) => ({
        id: l.id,
        locationId: l.locationId,
        name: l.name,
        description: l.description,
        timeOfDayDefault: (l.timeOfDayDefault ||
          'unspecified') as ProjectEntities['locations'][0]['timeOfDayDefault'],
        lighting: l.lighting,
        palette: (l.palette as string[]) || [],
        mustInclude: (l.mustInclude as string[]) || [],
        mustAvoid: (l.mustAvoid as string[]) || [],
      })),
      props: projectProps.map((p) => ({
        id: p.id,
        propId: p.propId,
        name: p.name,
        description: p.description,
        isRecurring: p.isRecurring ?? false,
      })),
      costumes: projectCostumes.map((c) => ({
        id: c.id,
        costumeId: c.costumeId,
        characterRef: c.characterRef,
        name: c.name,
        description: c.description,
        isDefault: c.isDefault ?? false,
      })),
    }

    return { scenes: scenesWithShots, entities }
  }
)

// Delete project
export const deleteProject = createServerFn().handler(
  async (ctx: { data: { projectId: string } }) => {
    await db.delete(projects).where(eq(projects.id, ctx.data.projectId))
    return { ok: true }
  }
)
