[ ] On Media generator history: add drag and drop on the image references based on the supported asset type
[ ] Add an option on the folder node where you can preview all the content inside a folder in a grid or list layout
[ ] Add preset for asset generation
[ ] Test that the agent can modify the video composition
[ ] Add a connection between contents (kind of lineage / maybe for assets too)
[ ] Make context donut work
[ ] test assigning tasks
[ ] create a skill using the agent
[ ] create commands (plan, brainstorm, remix)
[ ] add youtube link to the slash command
[ ] add file citation tag
[ ] add websearch sub-agent
[ ] display the files that have been listed or read uring tool calling
[ ] Connect cancel request during chat generation
[ ] create text editor supported rules for formatting and adding different elements
[ ] Media generator tool in the main agent
[ ] Design a kind of story board using the document (we'll need a skill for that)
[ ] Test context summarizing

----

[ ] Add copy asset link into the preview dialog
<!-- For video rendering scale -->
[ ] Add a queue in front of the video renderer so that we can control the concurrency
[ ] Create a pool of lambda function in different regions, so we can have more concurrency quotas
[ ] Add a cache on the video export in such way that if the composition doesn't change we resolve directly to an existing video if present
[ ] when we click the export let's open up a dialog where user chooses the setting (fps, where to save the output and how to name the file)

<!-- Design & improvement-->
[ ] improve how some of the tools and sub-agent are rendered
[ ] rename tavily tools to generic web tools
[ ] collapse some tools so we can avoid having too much tools (ex: loading skill, etc.)
[ ] improve the system prompt make it concise and add some policies for consistency and context grounding
[ ] improve command, when we just type / we should directly render all the available commands. And they should be appended as additional system prompt which inject behaviour that doesn't contradict the main system prompt.
[ ] maybe let's have a generate title as a tool instead of doing a parallel call
[ ] let's create a grid view for the file system that can help us preview the assets and add them easily to the video timeline
[ ] let's have a starting template when the chat is empty and an explainer when there is not tab open, let's open an home page with updates???
[ ] create 3 variations of captions style
[ ] improve the logos of the file so they look minimalistic and modern
[ ] handle the no internet state (maybe show a banner)
[ ] handle the error state for chat and media generation
[ ] redesign all our loadings
[ ] Add a table which will track the R2 object that needs to be deleted, then a cron job will clean periodically

<!-- Observability -->
[ ] integrate sentry for logs
[ ] add analytics for tracking

<!-- Operations -->
[ ] create professional email from google suite
[ ] create 3 virtual bank accounts (infrastructure expenses, marketing expenses and revenue)

<!-- Marketing -->
[ ] improve copywriting
[ ] create seo system
[ ] create youtube channels

<!-- Payment -->
[ ] design final pricing and plan
[ ] create product in polar.sh
[ ] validate account with polar.sh
[ ] connect payments

<!-- Issues -->
[ ] Add throttle on the inngest media generation function
[ ] Instruct the agent to work step by step (so it doesn't directly generate all the medias at once)
[ ] Add an error when the streaming fails, and when a run fails too (currently we display a raw message - replace it with a generic one)
[ ] Some types of files do not require user approval, like context file