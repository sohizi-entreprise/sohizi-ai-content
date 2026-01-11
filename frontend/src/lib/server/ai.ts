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
  generateOutlineSchema,
  generateShotsSchema,
  generateImagesSchema,
  projectBriefAndOutlineJsonSchema,
  sceneShotsAndEntitiesJsonSchema,
  type GenerateOutlineInput,
  type GenerateShotsInput,
  type GenerateImagesInput,
  type ProjectBriefAndOutlineJson,
  type SceneShotsAndEntitiesJson,
} from '@/lib/types'

// AI prompt templates
const OUTLINE_SYSTEM_PROMPT = `You are a professional video content strategist and scriptwriter. 
Your task is to create structured project briefs and outlines for video content.
Always output valid JSON matching the exact schema provided.
Be creative but practical, focusing on visual storytelling.`

const SHOTS_SYSTEM_PROMPT = `You are a professional cinematographer and storyboard artist.
Your task is to break down scenes into detailed shot lists with camera specifications.
Extract and define all characters, locations, props, and costumes mentioned.
Always output valid JSON matching the exact schema provided.
Focus on visual continuity and compelling compositions.`

// Helper to call OpenAI (using environment variable)
async function callLLM(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    // For development/demo, return mock data
    console.warn('OPENAI_API_KEY not set, using mock data')
    throw new Error('OPENAI_API_KEY not configured')
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Generate outline with AI
export const generateOutline = createServerFn().handler(
  async (ctx: { data: { projectId: string } & GenerateOutlineInput }) => {
    const validated = generateOutlineSchema.parse(ctx.data)
    const { projectId } = ctx.data
    const { sourceStory, tone, genre, targetLengthSec, stylePackId } = validated

    // Get project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))

    if (!project) {
      throw new Error('Project not found')
    }

    const userPrompt = `Create a video project brief and outline for the following:

FORMAT: ${project.format}
STORY/TOPIC: ${sourceStory}
${tone ? `TONE: ${tone}` : ''}
${genre ? `GENRE: ${genre}` : ''}
${targetLengthSec ? `TARGET LENGTH: ${targetLengthSec} seconds` : ''}
${stylePackId ? `STYLE PACK: ${stylePackId}` : ''}

Output JSON with this exact structure:
{
  "project_brief": {
    "title": "string",
    "logline": "string (1-2 sentences)",
    "audience": "general|kids|teens|adult",
    "tone": "string",
    "genre": "string",
    "style_pack_id": null,
    "constraints": {
      "must_include": ["array of required elements"],
      "must_avoid": ["array of things to avoid"],
      "forbidden_phrases": ["phrases not to use"]
    }
  },
  "outline": {
    "hook_options": ["3-5 different hook ideas"],
    "selected_hook": "the best hook",
    "acts": [
      {
        "act_id": "act_1",
        "title": "Act title",
        "summary": "Brief summary",
        "goals": ["story goals for this act"],
        "turning_points": ["key moments"],
        "scene_ids": ["scene_1", "scene_2"]
      }
    ]
  },
  "scenes": [
    {
      "scene_id": "scene_1",
      "act_id": "act_1",
      "order": 0,
      "title": "Scene title",
      "summary": "What happens in this scene",
      "location_hint": "Where it takes place",
      "time_of_day": "dawn|day|sunset|night|unspecified",
      "mood": "emotional tone"
    }
  ]
}

Create 3-7 scenes depending on the format and content.`

    let llmResult: ProjectBriefAndOutlineJson

    try {
      const response = await callLLM(OUTLINE_SYSTEM_PROMPT, userPrompt)
      llmResult = projectBriefAndOutlineJsonSchema.parse(JSON.parse(response))
    } catch (error) {
      // Generate mock data for development
      console.error('LLM call failed, using mock data:', error)
      llmResult = generateMockOutline(project.format, sourceStory, tone, genre)
    }

    // Save to database
    await db.insert(projectBriefs).values({
      projectId,
      title: llmResult.project_brief.title,
      logline: llmResult.project_brief.logline,
      audience: llmResult.project_brief.audience,
      tone: llmResult.project_brief.tone,
      genre: llmResult.project_brief.genre,
      stylePackId: llmResult.project_brief.style_pack_id,
      constraints: llmResult.project_brief.constraints,
      rawLlmJson: llmResult,
    })

    // Save acts
    for (let i = 0; i < llmResult.outline.acts.length; i++) {
      const act = llmResult.outline.acts[i]
      await db.insert(outlineActs).values({
        projectId,
        actId: act.act_id,
        order: i,
        title: act.title,
        summary: act.summary,
        goals: act.goals,
        turningPoints: act.turning_points,
        sceneIds: act.scene_ids,
      })
    }

    // Save scenes
    for (const scene of llmResult.scenes) {
      await db.insert(scenes).values({
        projectId,
        sceneId: scene.scene_id,
        actId: scene.act_id,
        order: scene.order,
        title: scene.title,
        summary: scene.summary,
        mood: scene.mood,
        timeOfDay: scene.time_of_day,
        locationRef: scene.location_hint,
      })
    }

    // Update project status
    await db
      .update(projects)
      .set({ status: 'OUTLINE_GENERATED', updatedAt: new Date() })
      .where(eq(projects.id, projectId))

    return { ok: true }
  }
)

// Generate shots with AI
export const generateShots = createServerFn().handler(
  async (ctx: { data: { projectId: string } & GenerateShotsInput }) => {
    const validated = generateShotsSchema.parse(ctx.data)
    const { projectId } = ctx.data
    const { scope, sceneId } = validated

    // Get project and scenes
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))

    if (!project) {
      throw new Error('Project not found')
    }

    const [brief] = await db
      .select()
      .from(projectBriefs)
      .where(eq(projectBriefs.projectId, projectId))

    let projectScenes = await db
      .select()
      .from(scenes)
      .where(eq(scenes.projectId, projectId))
      .orderBy(scenes.order)

    if (scope === 'scene' && sceneId) {
      projectScenes = projectScenes.filter((s) => s.sceneId === sceneId)
    }

    const userPrompt = `Create detailed shot lists and extract entities for these scenes:

PROJECT: ${brief?.title || project.name}
LOGLINE: ${brief?.logline || 'N/A'}
FORMAT: ${project.format}
TONE: ${brief?.tone || 'neutral'}

SCENES:
${projectScenes
  .map(
    (s) =>
      `- ${s.sceneId}: "${s.title}" - ${s.summary} (Location: ${s.locationRef}, Mood: ${s.mood}, Time: ${s.timeOfDay})`
  )
  .join('\n')}

Output JSON with this exact structure:
{
  "entities": {
    "characters": [
      {
        "character_id": "char_1",
        "name": "Character Name",
        "role": "protagonist|antagonist|supporting|narrator|unknown",
        "description": "Physical and personality description",
        "locked_traits": ["consistent visual traits"],
        "default_costume_id": null
      }
    ],
    "locations": [
      {
        "location_id": "loc_1",
        "name": "Location Name",
        "description": "Detailed visual description",
        "time_of_day_default": "day",
        "lighting": "lighting style",
        "palette": ["color1", "color2"],
        "must_include": ["required elements"],
        "must_avoid": ["things to avoid"]
      }
    ],
    "props": [
      {
        "prop_id": "prop_1",
        "name": "Prop Name",
        "description": "Visual description",
        "is_recurring": true
      }
    ],
    "costumes": [
      {
        "costume_id": "costume_1",
        "character_id": "char_1",
        "name": "Costume Name",
        "description": "Detailed costume description",
        "is_default": true
      }
    ]
  },
  "scenes": [
    {
      "scene_id": "scene_1",
      "order": 0,
      "title": "Scene Title",
      "summary": "Scene summary",
      "location_id": "loc_1",
      "time_of_day": "day",
      "mood": "scene mood",
      "shots": [
        {
          "shot_id": "shot_1",
          "scene_id": "scene_1",
          "order": 0,
          "shot_type": "establishing|wide|medium|closeup|insert",
          "angle": "eye_level|low|high|over_shoulder|top_down",
          "lens": "35mm",
          "movement": "static|slow_zoom_in|slow_zoom_out|pan_left|pan_right|tilt_up|tilt_down",
          "visual_summary": "What we see in this shot",
          "composition": "Composition details",
          "action": "What happens",
          "mood_keywords": ["mood", "keywords"],
          "entities_in_shot": {
            "character_ids": ["char_1"],
            "location_id": "loc_1",
            "prop_ids": [],
            "costume_ids": ["costume_1"]
          },
          "spoken": [
            {
              "utterance_id": "utt_1",
              "kind": "narration|dialogue",
              "speaker_id": "char_1",
              "text": "What is said"
            }
          ],
          "constraints": {
            "must_keep": ["consistent elements"],
            "must_avoid": ["things to avoid"],
            "allow_variation": ["can vary"]
          }
        }
      ]
    }
  ]
}

Create 3-6 shots per scene with varied shot types and angles.`

    let llmResult: SceneShotsAndEntitiesJson

    try {
      const response = await callLLM(SHOTS_SYSTEM_PROMPT, userPrompt)
      llmResult = sceneShotsAndEntitiesJsonSchema.parse(JSON.parse(response))
    } catch (error) {
      // Generate mock data for development
      console.error('LLM call failed, using mock data:', error)
      llmResult = generateMockShots(projectScenes)
    }

    // Save entities
    for (const char of llmResult.entities.characters) {
      await db.insert(characters).values({
        projectId,
        characterId: char.character_id,
        name: char.name,
        role: char.role,
        description: char.description,
        lockedTraits: char.locked_traits,
        defaultCostumeId: char.default_costume_id,
      })
    }

    for (const loc of llmResult.entities.locations) {
      await db.insert(locations).values({
        projectId,
        locationId: loc.location_id,
        name: loc.name,
        description: loc.description,
        timeOfDayDefault: loc.time_of_day_default,
        lighting: loc.lighting,
        palette: loc.palette,
        mustInclude: loc.must_include,
        mustAvoid: loc.must_avoid,
      })
    }

    for (const prop of llmResult.entities.props) {
      await db.insert(props).values({
        projectId,
        propId: prop.prop_id,
        name: prop.name,
        description: prop.description,
        isRecurring: prop.is_recurring,
      })
    }

    for (const costume of llmResult.entities.costumes) {
      await db.insert(costumes).values({
        projectId,
        costumeId: costume.costume_id,
        characterRef: costume.character_id,
        name: costume.name,
        description: costume.description,
        isDefault: costume.is_default,
      })
    }

    // Update scenes and save shots
    for (const sceneData of llmResult.scenes) {
      // Find the scene in DB
      const [dbScene] = await db
        .select()
        .from(scenes)
        .where(eq(scenes.sceneId, sceneData.scene_id))

      if (!dbScene) continue

      // Update scene with location_id
      await db
        .update(scenes)
        .set({
          locationRef: sceneData.location_id,
          mood: sceneData.mood,
          updatedAt: new Date(),
        })
        .where(eq(scenes.id, dbScene.id))

      // Save shots
      for (const shot of sceneData.shots) {
        await db.insert(shots).values({
          projectId,
          sceneDbId: dbScene.id,
          shotId: shot.shot_id,
          order: shot.order,
          shotType: shot.shot_type,
          angle: shot.angle,
          lens: shot.lens,
          movement: shot.movement,
          visualSummary: shot.visual_summary,
          composition: shot.composition,
          action: shot.action,
          moodKeywords: shot.mood_keywords,
          entitiesInShot: shot.entities_in_shot,
          spoken: shot.spoken,
          constraints: shot.constraints,
          rawLlmJson: shot,
        })
      }
    }

    // Update project status
    await db
      .update(projects)
      .set({ status: 'SHOTS_GENERATED', updatedAt: new Date() })
      .where(eq(projects.id, projectId))

    return { ok: true }
  }
)

// Generate images for shots
export const generateImages = createServerFn().handler(
  async (ctx: { data: { projectId: string } & GenerateImagesInput }) => {
    const validated = generateImagesSchema.parse(ctx.data)
    const { projectId } = ctx.data
    const { shotIds, quality, model: requestedModel } = validated

    // Get project entities for consistency
    const projectCharacters = await db
      .select()
      .from(characters)
      .where(eq(characters.projectId, projectId))

    const projectLocations = await db
      .select()
      .from(locations)
      .where(eq(locations.projectId, projectId))

    const projectCostumes = await db
      .select()
      .from(costumes)
      .where(eq(costumes.projectId, projectId))

    // Get shots to generate
    const shotsToGenerate = await db
      .select()
      .from(shots)
      .where(eq(shots.projectId, projectId))

    const filteredShots =
      shotIds.length > 0
        ? shotsToGenerate.filter((s) => shotIds.includes(s.id))
        : shotsToGenerate

    const falApiKey = process.env.FAL_KEY

    for (const shot of filteredShots) {
      // Build prompt from entities
      const prompt = buildImagePrompt(
        shot,
        projectCharacters,
        projectLocations,
        projectCostumes
      )

      const negativePrompt =
        'blurry, low quality, deformed hands, extra limbs, inconsistent character, distorted face, text, watermark, logo, captions'

      const seed = Math.floor(Math.random() * 1000000)
      const model = requestedModel || 'fal-ai/flux/schnell'

      let imageUrl: string
      let width = 1024
      let height = 576

      if (falApiKey) {
        // Call fal.ai API
        try {
          const response = await fetch(`https://fal.run/${model}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Key ${falApiKey}`,
            },
            body: JSON.stringify({
              prompt,
              negative_prompt: negativePrompt,
              image_size:
                quality === 'final' ? 'landscape_16_9' : 'landscape_4_3',
              num_inference_steps: quality === 'final' ? 28 : 4,
              seed,
            }),
          })

          if (!response.ok) {
            throw new Error(`fal.ai error: ${await response.text()}`)
          }

          const result = await response.json()
          imageUrl = result.images?.[0]?.url || result.image?.url
          width = result.images?.[0]?.width || 1024
          height = result.images?.[0]?.height || 576
        } catch (error) {
          console.error('fal.ai call failed:', error)
          // Use placeholder
          imageUrl = `https://placehold.co/${width}x${height}/1a1a2e/eee?text=Shot+${shot.order + 1}`
        }
      } else {
        // Use placeholder for development
        imageUrl = `https://placehold.co/${width}x${height}/1a1a2e/eee?text=Shot+${shot.order + 1}`
      }

      // Save image
      await db.insert(shotImages).values({
        shotDbId: shot.id,
        provider: 'fal',
        model,
        prompt,
        negativePrompt,
        seed,
        imageUrl,
        width,
        height,
        meta: { quality },
      })
    }

    return { ok: true }
  }
)

// Helper: Build image prompt from shot and entities
function buildImagePrompt(
  shot: typeof shots.$inferSelect,
  chars: Array<typeof characters.$inferSelect>,
  locs: Array<typeof locations.$inferSelect>,
  costumesData: Array<typeof costumes.$inferSelect>
): string {
  const lines: string[] = []

  // Style
  lines.push('STYLE: Cinematic, high quality, professional cinematography')

  // Location
  const entities = shot.entitiesInShot as {
    character_ids: string[]
    location_id: string
    prop_ids: string[]
    costume_ids: string[]
  } | null

  if (entities?.location_id) {
    const location = locs.find((l) => l.locationId === entities.location_id)
    if (location) {
      const palette = (location.palette as string[]) || []
      const mustInclude = (location.mustInclude as string[]) || []
      lines.push(
        `LOCATION: ${location.description}; lighting=${location.lighting || 'natural'}; palette=${palette.join(', ')}; must_include=${mustInclude.join(', ')}`
      )
    }
  }

  // Characters
  if (entities?.character_ids?.length) {
    const charDescriptions = entities.character_ids
      .map((id) => {
        const char = chars.find((c) => c.characterId === id)
        if (!char) return null

        const traits = (char.lockedTraits as string[]) || []
        const costume = entities.costume_ids
          ?.map((cid) => costumesData.find((co) => co.costumeId === cid))
          .filter(Boolean)[0]

        return `${char.name}: ${char.description}. Traits: ${traits.join(', ')}${costume ? `. Wearing: ${costume.description}` : ''}`
      })
      .filter(Boolean)

    if (charDescriptions.length) {
      lines.push(`CHARACTERS: ${charDescriptions.join('; ')}`)
    }
  }

  // Shot specs
  lines.push(
    `SHOT: ${shot.shotType}, angle=${shot.angle}, lens=${shot.lens || '35mm'}, movement=${shot.movement}`
  )

  // Action and composition
  if (shot.action) {
    lines.push(`ACTION: ${shot.action}`)
  }
  if (shot.composition) {
    lines.push(`COMPOSITION: ${shot.composition}`)
  }

  // Visual summary
  lines.push(`SCENE: ${shot.visualSummary}`)

  // Mood
  const moodKeywords = (shot.moodKeywords as string[]) || []
  if (moodKeywords.length) {
    lines.push(`MOOD: ${moodKeywords.join(', ')}`)
  }

  return lines.join('\n')
}

// Mock data generators for development
function generateMockOutline(
  format: string,
  sourceStory: string,
  tone?: string | null,
  genre?: string | null
): ProjectBriefAndOutlineJson {
  const title = sourceStory.split(' ').slice(0, 5).join(' ')

  return {
    project_brief: {
      title: `${title}...`,
      logline: `A ${tone || 'compelling'} ${format} about ${sourceStory.slice(0, 100)}...`,
      audience: 'general',
      tone: tone || 'engaging',
      genre: genre || 'narrative',
      style_pack_id: null,
      constraints: {
        must_include: ['clear storytelling', 'visual appeal'],
        must_avoid: ['confusion', 'slow pacing'],
        forbidden_phrases: [],
      },
    },
    outline: {
      hook_options: [
        'Start with a provocative question',
        'Begin with stunning visuals',
        'Open with a surprising fact',
      ],
      selected_hook: 'Begin with stunning visuals',
      acts: [
        {
          act_id: 'act_1',
          title: 'Setup',
          summary: 'Introduce the world and characters',
          goals: ['Establish setting', 'Introduce protagonist'],
          turning_points: ['Initial conflict revealed'],
          scene_ids: ['scene_1', 'scene_2'],
        },
        {
          act_id: 'act_2',
          title: 'Confrontation',
          summary: 'The main journey and challenges',
          goals: ['Develop conflict', 'Show growth'],
          turning_points: ['Midpoint revelation'],
          scene_ids: ['scene_3', 'scene_4'],
        },
        {
          act_id: 'act_3',
          title: 'Resolution',
          summary: 'Climax and conclusion',
          goals: ['Resolve conflict', 'Deliver message'],
          turning_points: ['Final climax'],
          scene_ids: ['scene_5'],
        },
      ],
    },
    scenes: [
      {
        scene_id: 'scene_1',
        act_id: 'act_1',
        order: 0,
        title: 'Opening',
        summary: 'Establish the world and introduce the main character',
        location_hint: 'Main setting',
        time_of_day: 'day',
        mood: 'intriguing',
      },
      {
        scene_id: 'scene_2',
        act_id: 'act_1',
        order: 1,
        title: 'The Inciting Incident',
        summary: 'Something disrupts the normal world',
        location_hint: 'Secondary location',
        time_of_day: 'day',
        mood: 'tense',
      },
      {
        scene_id: 'scene_3',
        act_id: 'act_2',
        order: 2,
        title: 'Rising Action',
        summary: 'The protagonist faces challenges',
        location_hint: 'Journey location',
        time_of_day: 'sunset',
        mood: 'dramatic',
      },
      {
        scene_id: 'scene_4',
        act_id: 'act_2',
        order: 3,
        title: 'Midpoint',
        summary: 'A major revelation or turning point',
        location_hint: 'Key location',
        time_of_day: 'night',
        mood: 'intense',
      },
      {
        scene_id: 'scene_5',
        act_id: 'act_3',
        order: 4,
        title: 'Climax & Resolution',
        summary: 'The final confrontation and conclusion',
        location_hint: 'Final setting',
        time_of_day: 'dawn',
        mood: 'triumphant',
      },
    ],
  }
}

function generateMockShots(
  projectScenes: Array<typeof scenes.$inferSelect>
): SceneShotsAndEntitiesJson {
  const shotTypes = [
    'establishing',
    'wide',
    'medium',
    'closeup',
    'insert',
  ] as const
  const angles = [
    'eye_level',
    'low',
    'high',
    'over_shoulder',
    'top_down',
  ] as const
  const movements = [
    'static',
    'slow_zoom_in',
    'slow_zoom_out',
    'pan_left',
    'pan_right',
  ] as const

  return {
    entities: {
      characters: [
        {
          character_id: 'char_protagonist',
          name: 'The Protagonist',
          role: 'protagonist',
          description:
            'A determined individual in their 30s with expressive eyes and confident posture',
          locked_traits: [
            'expressive eyes',
            'confident posture',
            'warm skin tone',
          ],
          default_costume_id: 'costume_1',
        },
        {
          character_id: 'char_narrator',
          name: 'Narrator',
          role: 'narrator',
          description: 'Authoritative voice guiding the story',
          locked_traits: [],
          default_costume_id: null,
        },
      ],
      locations: [
        {
          location_id: 'loc_main',
          name: 'Main Setting',
          description:
            'A visually striking environment that reflects the story tone',
          time_of_day_default: 'day',
          lighting: 'natural soft lighting',
          palette: ['warm amber', 'soft blue', 'earth tones'],
          must_include: ['depth', 'visual interest'],
          must_avoid: ['clutter', 'distracting elements'],
        },
      ],
      props: [
        {
          prop_id: 'prop_1',
          name: 'Key Object',
          description: 'An important object that carries symbolic meaning',
          is_recurring: true,
        },
      ],
      costumes: [
        {
          costume_id: 'costume_1',
          character_id: 'char_protagonist',
          name: 'Default Outfit',
          description:
            'Clean, contemporary clothing that reflects character personality',
          is_default: true,
        },
      ],
    },
    scenes: projectScenes.map((scene) => ({
      scene_id: scene.sceneId,
      order: scene.order,
      title: scene.title,
      summary: scene.summary,
      location_id: 'loc_main',
      time_of_day: (scene.timeOfDay || 'day') as
        | 'dawn'
        | 'day'
        | 'sunset'
        | 'night'
        | 'unspecified',
      mood: scene.mood || 'neutral',
      shots: Array.from({ length: 4 }, (_, i) => ({
        shot_id: `${scene.sceneId}_shot_${i + 1}`,
        scene_id: scene.sceneId,
        order: i,
        shot_type: shotTypes[i % shotTypes.length],
        angle: angles[i % angles.length],
        lens: i === 0 ? '24mm' : i === 3 ? '85mm' : '35mm',
        movement: movements[i % movements.length],
        visual_summary: `${shotTypes[i % shotTypes.length]} shot of the scene - ${scene.summary}`,
        composition: 'Rule of thirds, balanced framing',
        action: 'Character interaction and story progression',
        mood_keywords: [scene.mood || 'neutral', 'cinematic', 'engaging'],
        entities_in_shot: {
          character_ids: ['char_protagonist'],
          location_id: 'loc_main',
          prop_ids: i === 3 ? ['prop_1'] : [],
          costume_ids: ['costume_1'],
        },
        spoken:
          i === 0
            ? [
                {
                  utterance_id: `${scene.sceneId}_utt_${i + 1}`,
                  kind: 'narration' as const,
                  speaker_id: 'char_narrator',
                  text: 'Setting the scene...',
                },
              ]
            : [],
        constraints: {
          must_keep: ['character consistency', 'lighting continuity'],
          must_avoid: ['jump cuts', 'mismatched elements'],
          allow_variation: ['background details'],
        },
      })),
    })),
  }
}
