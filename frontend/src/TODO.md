[ ] We can't add a segment between scenes (Think about it, maybe leave it for flexibility)
[ ] Try to anticipate some actions that user can request like: combine 2 scenes, remove a scene, add a scene below, etc...
[ ] Think about how to solve the sync state problem - the content keeps the old data

---
[x] inline menu on the text editor
[x] floating menu
[x] handle llm diff changes
[x] character tagging
[x] location tagging
[x] object tagging
[ ] highligh known entities
[ ] handle llm suggestions
[ ] handle quick actions (summarize, polish, etc...)

---

Regarding AI editors

[ ] implement single changes individually
[ ] implement scroll to concrete changed section
[ ] stop eventSource for always trying to reconnect
[ ] implement editor change logs on the server to help the model track of the changes that happened
[ ] improve the chat rendering UI/UX
[ ] implement the token usage (donut percent) on the chat input
[ ] Change the synopsis block types to simple like title and paragraph
[ ] Render skeleton on the paper while we are streaming
[ ] make possible to hide and show the chat container
[ ] Make the diff accept/decline reactif. Currently the buttons don't appear as you generate changes
[ ] while regenerating the outline of scenes, we should take into account the new characters and locations that might be added. so basically we need to fetch entities
[ ] When returning the project detail, avoid sending columns with big payload to reduce bandwidth
[ ] Validate Prose before saving them