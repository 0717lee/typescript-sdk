---
'@modelcontextprotocol/server': patch
---

Fix `remove()` silently doing nothing on a prompt, resource, or resource-template handle once the entry has been renamed. Each `update` closure captured the registration key and never reassigned it, so after a rename `delete this._registeredX[key]` targeted a key the entry no longer occupied: the live entry stayed listed and callable, `list_changed` fired for a no-op removal, and a second rename left the entry aliased under two live keys. The update closure now reassigns its captured key when the move succeeds, the same pattern `RegisteredTool` already uses.
