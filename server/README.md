
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
