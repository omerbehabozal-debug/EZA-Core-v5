# Mirror Network — migration & publish QA

## Unique index preflight (`add_mirror_network_publish_unique`)

Run **before** applying the migration in production:

```sql
SELECT user_id, conversation_id, COUNT(*) AS row_count
FROM mirror_network_nodes
WHERE conversation_id IS NOT NULL
GROUP BY user_id, conversation_id
HAVING COUNT(*) > 1;
```

If any rows are returned, resolve duplicates manually. The migration **does not auto-delete**; it fails with an explicit error listing sample duplicates.

## Scene image publish semantics

`publish_mirror_to_network` uses **non-null wins**:

- Existing `scene_image_url` is never cleared by a later publish with `sceneImageUrl=null`
- A non-null incoming scene always updates a null existing scene
- Concurrent publish + IntegrityError recovery preserves the winning scene URL

## Staging smoke (before launch)

- Slow network: null initial publish, then scene completion
- Double-click / parallel publish: single node, landing has scene
- iOS Safari / Android Chrome native share
- Guest → login → refresh → branch → new mirror
