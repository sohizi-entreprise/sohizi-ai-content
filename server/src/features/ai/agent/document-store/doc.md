Goal

Let's build a layer that convert bash command into an object that represents an operation to apply 
to query postgres db.

Supported bash commands
- cat (with all available flags)
- head
- grep (with all available flags)
- jq (to retrieve specific keys from json)

Note: All other bash commands are restricted | pipe operations are not supported.

The postgres tables will be transformed into an document map. where tables will be considered as folders and each row of the table as file.

syntax:
- read <file> | flags: --head <int>, --key <json path>
- list <folder> flags: -count (return the count of files within the folder)
- search <folder | file> <query> flags: --top <int>, -count, -i (case insensitive), -f (only filenames), --key (search document by a given json key)
- inspect <document> | flags: --schema
- extract (maybe for json key extraction)

The json output object should look like

```json
{
    "operation": "read or search",
    "table": "...",
    "key": "...",
    "limit": ""
}
```

Problem:
what if we ask the agent a question like: "in which scene the protagonist fight a demon"

Solution
- Build a scene summary map [scene node + last_update]
- Build a dedicated tool that return the scene summary
- If the updated date on postgres < our latest update on the node
- We send multiple request to update the summary
- When we do send a request, on the background we check if 
- Keep on the same table (just add column - )