[ ] On Media generator history: add drag and drop on the image references based on the supported asset type
[ ] Add an option on the folder node where you can preview all the content inside a folder in a grid or list layout
[ ] Add preset for asset generation
[ ] Test that the agent can modify the video composition
[ ] Add a connection between contents (kind of lineage / maybe for assets too)
[ ] Make context donut work
[ ] test assigning tasks
[ ] create a skill using the agent
[ ] create a command that can build an entire video from scratch
[ ] add youtube link to the slash command
[ ] add file citation tag
[ ] add websearch sub-agent
[ ] display the files that have been listed or read uring tool calling
[ ] Connect cancel request during chat generation
[ ] create text editor supported rules for formatting and adding different elements
[ ] Media generator tool in the main agent
[ ] Design a kind of story board using the document (we'll need a skill for that)

----

[ ] Add copy asset link into the preview dialog
<!-- For video rendering scale -->
[ ] Add a queue in front of the video renderer so that we can control the concurrency
[ ] Create a pool of lambda function in different regions, so we can have more concurrency quotas
[ ] Add a cache on the video export in such way that if the composition doesn't change we resolve directly to an existing video if present
[ ] when we click the export let's open up a dialog where user chooses the setting (fps, where to save the output and how to name the file)