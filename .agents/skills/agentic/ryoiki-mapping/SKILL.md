---
name: ryoiki-mapping
description: 'help map the correct ryoiki into archive list json'
---

## before starting
- run bash script `archive-epic.sh status`


## Only file allow to touch 
- .agents/changelogs/archive/index.json

## Present a single table once, for the whole epic:
   
| Story | Domain | Current Ryoiki | Suggested Ryoiki | Map Ryoiki |
|---|---|---|---|---|
| (one row per draft entry) | | | | |
   
- Current Ryoiki = what's in the draft (auto-generated from the changelog file)
- Suggested Ryoiki = AI suggested closest match
- Map Ryoiki = the canonical ryoiki from `.agents/reference/ryoiki-aliases.json`. Always use this value
   

## wait for user response

type of response
OK - accept Alias Map Ryoiki
Rename - use what user provide
Blacklist - mark as blacklisted
Add - add entry
Delete - delete entry

## if response includes add
- this is because some entries doesn't have a distinct ST changelog 
- look through the design spec for the entry details and create entry

## if response includes delete
- delete the entry from index.json

## LAST: map user response as ryioki confirmation data

return a JSON array of `{"id": "...", "ryoiki": "..."}`