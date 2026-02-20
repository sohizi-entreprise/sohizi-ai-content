
components of a screenplay:
- slugline / scene heading: (int/ext - location - time of the day)
- action - scene description
- character name - (name, V.O - O.S)
- Dialogue
- Parenthetical - ()
- Transitions


DB schemas
---

block schema:
- id: uuid
- type: ex. act, scene, action, dialogue, etc.
- parent_id : the id of the parent block
- deleted: bool
- data (jsonB)
- schema_version

elements (characters, location, props) schema:
- id: uuid
- type
- deleted: bool
- data (jsonB)
- schema_version

block_elements_relation
- block_id
- element_id


Agents workflow:

1. Script creation using AI
   - Generate 3 narratives arc from the idea brief
   - Generate a synopsis from the concept
   - Generate a story outline (acts - list of beats)
   - Generate the script bible (characters - locations - props)
   - Develop scenes and dialogue


I listed scenes that represent beats, but I didn’t chain them with strong because of that… therefore… logic.
Use “But/Therefore” scene chaining
After every scene, force one connector:
THEREFORE (the action causes the next problem)
BUT (the plan is blocked by a twist)


1. Brief Refinement & Validation
   - Refine concept brief
   - Define: genre, tone, target audience, core theme

2. Narrative Arc Generation
   - Generate 3 narrative arc options
   - Compare and select strongest arc

3. Story Synopsis (Optional but Recommended)
   - Generate concise story synopsis from selected arc
   - Validate story logic and emotional core

4. Story Outline Development
   - Generate detailed outline (acts - beats)
   - Validate structure and pacing
   - Ensure character arcs are integrated

5. Script Bible Creation
   - Characters (with arcs, relationships, motivations)
   - Locations (with descriptions and significance)
   - Props/objects (with symbolic meaning if applicable)
   - World-building rules (if applicable)

6. Scene Development
   - Develop scenes with dialogue
   - Ensure each scene serves story/character
   - Maintain tone consistency

7. Revision & Polish
   - Review for consistency
   - Refine dialogue
   - Tighten pacing


1. Brief/Concept
   ↓
2. Narrative Arc Selection
   ↓
3. Story Outline (Acts & Beats) ← Structure framework
   ↓
4. Script Bible (Characters, Locations, etc.)
   ↓
5. Scene Development ← Detailed execution of beats
   ↓
6. Dialogue & Polish