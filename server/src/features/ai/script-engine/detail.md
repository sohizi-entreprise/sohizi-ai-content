# Script Engine

The role of the script engine is to help generate a full script from an initial idea.

## Design Principles

1. **Feedback Loop Mechanism** - Allow users to provide feedback at each stage that influences subsequent stages
2. **Genre/Tone Consistency** - These parameters flow through all components for consistency
3. **Versioning** - Track iterations of each component's output
4. **Confidence Scores** - Help users understand which parts might need more human refinement

---

## Components

### 1. Concept Generator

Given an initial idea and requirements, it generates 3 narrative arcs that the user should choose from. The generated concepts are saved in the database.

**Features:**
- Generates logline (one-sentence pitch)
- Identifies genre, tone, and target audience
- Extracts thematic elements
- Estimates format and runtime

**JSON Output Schema:**
```json
{
  "concepts": [
    {
      "id": "concept_uuid",
      "title": "string",
      "logline": "One sentence that captures the essence",
      "synopsis": "2-3 paragraph narrative arc description",
      "genre": ["drama", "thriller"],
      "tone": ["dark", "suspenseful"],
      "themes": ["redemption", "family"],
      "source": "agent | user",
      "is_selected": false,
    }
  ],
}
```

---

### 2. Synopsis Generator

Given a concept, it generates a detailed synopsis of the story.

**Features:**
- Breaks story into beginning/middle/end structure
- Identifies protagonist's arc explicitly
- Defines central conflict and stakes
- Maps key turning points

**JSON Output Schema:**
```json
{
  "synopsis": {
    "id": "synopsis_uuid",
    "full_text": "Complete synopsis as prose",
    "structure": {
      "setup": "First act setup description",
      "confrontation": "Second act conflicts and complications",
      "resolution": "Third act climax and resolution"
    },
    "protagonist_arc": {
      "starting_state": "Who they are at the beginning",
      "transformation": "What changes them",
      "ending_state": "Who they become"
    },
    "central_conflict": "The main dramatic question",
    "stakes": "What happens if protagonist fails",
    "key_turning_points": [
      {
        "name": "Inciting Incident",
        "description": "string",
        "approximate_position": 0.10
      },
      {
        "name": "First Act Break",
        "description": "string",
        "approximate_position": 0.25
      },
      {
        "name": "Midpoint",
        "description": "string",
        "approximate_position": 0.50
      },
      {
        "name": "Second Act Break",
        "description": "string",
        "approximate_position": 0.75
      },
      {
        "name": "Climax",
        "description": "string",
        "approximate_position": 0.90
      }
    ],
    "version": 1,
    "supervisor_notes": []
  }
}
```

---

### 3. Outline Creator

Given a synopsis, generates the script outline which includes the acts, main beats, and list of scenes.

**Features:**
- Defines scene purpose (what each scene accomplishes narratively)
- Adds emotional beats per scene
- Includes page/time estimates per scene
- Tracks character appearances per scene
- Adds location requirements early for production planning

**JSON Output Schema:**
```json
{
  "outline": {
    "id": "outline_uuid",
    "synopsis_id": "reference",
    "total_estimated_pages": 110,
    "acts": [
      {
        "act_number": 1,
        "title": "Setup",
        "description": "Act description",
        "page_range": { "start": 1, "end": 25 },
        "beats": [
          {
            "beat_id": "beat_uuid",
            "name": "Opening Image",
            "description": "string",
            "emotional_tone": "melancholic"
          }
        ],
        "scenes": [
          {
            "scene_id": "scene_uuid",
            "scene_number": 1,
            "slugline": "INT. COFFEE SHOP - DAY",
            "location": {
              "name": "Coffee Shop",
              "int_ext": "INT",
              "time_of_day": "DAY"
            },
            "summary": "Brief scene description",
            "purpose": "Establish protagonist's mundane life",
            "emotional_beat": "contentment before the storm",
            "characters_present": ["protagonist_id", "character_2_id"],
            "estimated_pages": 2.5,
            "connects_to_beat": "beat_uuid"
          }
        ]
      }
    ],
    "version": 1
  }
}
```

---

### 4. Story Bible Generator

Generates a single source of truth (characters, locations, props) of the entire story. It also generates the character properties, style, and evolution.

**Features:**
- Defines character relationships graph
- Includes character voice notes (how they speak, verbal tics)
- Adds visual references/description tags for characters and locations
- Includes timeline if story spans significant time
- Adds rules of the world for genre-specific logic (especially for sci-fi/fantasy)
- Tracks themes and recurring motifs

**JSON Output Schema:**
```json
{
  "story_bible": {
    "id": "bible_uuid",
    "outline_id": "reference",
    "characters": [
      {
        "character_id": "char_uuid",
        "name": "Sarah Chen",
        "role": "protagonist | antagonist | supporting | minor",
        "age": 34,
        "occupation": "Detective",
        "physical_description": "string",
        "personality_traits": ["determined", "secretive", "compassionate"],
        "backstory": "Relevant history",
        "motivation": "What drives them",
        "flaw": "Their key weakness",
        "arc": {
          "starting_point": "string",
          "evolution_triggers": ["event 1", "event 2"],
          "ending_point": "string"
        },
        "voice": {
          "speech_pattern": "Short, clipped sentences",
          "vocabulary_level": "educated but street-smart",
          "verbal_tics": ["says 'look' before making a point"],
          "sample_dialogue": "Look, I don't care what the chief says..."
        },
        "relationships": [
          {
            "character_id": "other_char_uuid",
            "relationship_type": "partner",
            "dynamic": "Tense professional respect hiding deeper bond",
            "evolution": "From distrust to reliance"
          }
        ],
        "appears_in_scenes": ["scene_uuid_1", "scene_uuid_2"]
      }
    ],
    "locations": [
      {
        "location_id": "loc_uuid",
        "name": "The Precinct",
        "type": "interior",
        "description": "Detailed visual description",
        "atmosphere": "Fluorescent-lit, coffee-stained chaos",
        "significance": "Represents Sarah's comfort zone",
        "appears_in_scenes": ["scene_uuid_1"]
      }
    ],
    "props": [
      {
        "prop_id": "prop_uuid",
        "name": "Sarah's Badge",
        "description": "Worn, scratched detective badge",
        "significance": "Symbol of her identity crisis",
        "appears_in_scenes": ["scene_uuid_1", "scene_uuid_5"]
      }
    ],
    "world_rules": {
      "time_period": "Present day",
      "setting": "Chicago",
      "special_rules": ["Any genre-specific logic"],
      "timeline": [
        {
          "event": "Story begins",
          "date": "March 2024",
          "notes": ""
        }
      ]
    },
    "themes_and_motifs": {
      "primary_themes": ["justice vs. law", "personal redemption"],
      "recurring_motifs": [
        {
          "motif": "Rain",
          "meaning": "Cleansing/rebirth",
          "appearances": ["scene_uuid_1", "scene_uuid_final"]
        }
      ]
    },
    "version": 1
  }
}
```

---

### 5. Script Writer

Based on the outline and story bible, writes each scene 2 by 2.

**Features:**
- Writes scenes in pairs grouped by dramatic unit (not just sequential order)
- Includes parentheticals guidance
- Adds subtext notes for actors/directors
- Includes transition suggestions
- Tracks page count per scene for pacing

**JSON Output Schema:**
```json
{
  "script_draft": {
    "id": "draft_uuid",
    "bible_id": "reference",
    "outline_id": "reference",
    "format": "screenplay",
    "scenes": [
      {
        "scene_id": "scene_uuid",
        "scene_number": 1,
        "slugline": "INT. COFFEE SHOP - DAY",
        "content": {
          "elements": [
            {
              "type": "action",
              "text": "SARAH CHEN (34), badge clipped to her belt...",
              "subtext_note": "Establish her as someone who never fully relaxes"
            },
            {
              "type": "dialogue",
              "character": "SARAH",
              "parenthetical": "without looking up",
              "line": "I'll have the usual.",
              "subtext_note": "She's distracted, mind elsewhere"
            },
            {
              "type": "action",
              "text": "Her phone BUZZES. She glances at it, freezes."
            }
          ],
          "raw_text": "Full scene in standard screenplay format"
        },
        "transition": "CUT TO:",
        "page_count": 2.5,
        "notes": {
          "director_notes": "Consider handheld for intimacy",
          "revision_suggestions": []
        }
      }
    ],
    "total_pages": 108,
    "version": 1,
    "status": "first_draft"
  }
}
```

---

## Supervisor Review

At the end of each step, a supervisor reviews and suggests improvements which will be later applied.

**JSON Output Schema:**
```json
{
  "review": {
    "id": "review_uuid",
    "component": "concept | synopsis | outline | bible | script",
    "target_id": "uuid of reviewed item",
    "overall_score": 0.82,
    "passed": true,
    "feedback": [
      {
        "feedback_id": "feedback_uuid",
        "category": "character_consistency | pacing | dialogue | structure | tone",
        "severity": "critical | major | minor | suggestion",
        "location": "Reference to specific section/scene",
        "issue": "Description of the problem",
        "recommendation": "Suggested fix"
      }
    ],
    "approved_for_next_stage": true,
    "requires_revision": false,
    "revision_priority": ["feedback_id_1", "feedback_id_2"]
  }
}
```

---

## Pipeline Flow

```
[Initial Idea + Requirements]
            │
            ▼
    ┌───────────────┐
    │   Concept     │ ──► Supervisor Review ──► User Selection
    │   Generator   │
    └───────────────┘
            │
            ▼
    ┌───────────────┐
    │   Synopsis    │ ──► Supervisor Review ──► User Approval
    │   Generator   │
    └───────────────┘
            │
            ▼
    ┌───────────────┐
    │   Outline     │ ──► Supervisor Review ──► User Approval
    │   Creator     │
    └───────────────┘
            │
            ▼
    ┌───────────────┐
    │  Story Bible  │ ──► Supervisor Review ──► User Approval
    │   Generator   │
    └───────────────┘
            │
            ▼
    ┌───────────────┐
    │    Script     │ ──► Supervisor Review ──► User Approval
    │    Writer     │
    └───────────────┘
            │
            ▼
    [Final Script Draft]
```

---

## Summary of Key Features

| Component | Key Features |
|-----------|--------------|
| Concept | Logline, themes, genre, confidence score |
| Synopsis | Structure breakdown, protagonist arc, turning points |
| Outline | Scene purpose, emotional beats, page estimates |
| Bible | Character voice, relationships graph, world rules, motifs |
| Script | Subtext notes, element-level structure, transitions |
| Supervisor | Standardized review schema with severity levels |
