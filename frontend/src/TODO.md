TODOS before Jun 10

[ ] AI tools generation for media
[ ] Media preview (react-doc-viewer)
[ ] Attach file to input by drag and drop
[ ] Image editor with AI
[ ] Billing system
[ ] Auth user + organization
[ ] Project core settings
[ ] Templating for flexibility
[ ] Writing tools for AI
[ ] Searching tools for AI
[ ] Assign tool
[ ] Landing pages
[ ] Polish design

TODOS Jun 11 - Jun 23

[ ] Video timeline to database
[ ] Video editor sub-agent
[ ] Video timeline tools
[ ] Add captions
[ ] Add transitions + effects
[ ] Video rendering engine
[ ] Export video

======
[ ] Remove the messages table
[ ] The agent expose some internal errors of the system, when something goes wrong let's rather return a generic error
[ ] create other extensions for markdown
[ ] Make the checkpoints robust to bad message ordering
[ ] Add compression
[ ] Add memory
[ ] Polish the diff (especially when you try to reformat a doc)
[ ] improve tool in the chat design
[ ] Fix the problem, the app is freezing during streaming
[ ] Handle drag and drop for file in timeline
[ ] Optimize captions so it can run on the background
[ ] clean timeline.tsx - decompose logic into hooks
[ ] avoid dropping node on the timeline layer - it stucks we should fix that
[ ] inside the storage.ts the max file size is 15MB for video and audio 


===== Final stages ========
1. Create a temporary context which lives in the session that maintain context between main-agent and sub-agent