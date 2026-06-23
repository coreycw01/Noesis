# Atlas Custom Maps Plan

## Summary

Atlas should support two coordinated map modes:

- **Auto Map**: the app-generated concept graph that connects concepts through shared evidence.
- **Custom Maps**: user-created maps where the user chooses concepts, places nodes, and creates typed links.

This plan also replaces visible **branching** language with **linking** language. The core action should feel like: **Link this idea**.

## Product Intent

The Atlas is the visual thinking surface. It should not only show what Noesis can infer automatically. It should also let users deliberately arrange their own understanding.

Auto Map answers:

```txt
What does Noesis see?
```

Custom Maps answer:

```txt
How do I want to arrange this part of my mind?
```

Custom Maps should be useful for:

- a single book or source
- a life theme
- a project
- a philosophy area
- an inquiry being investigated
- a position being developed
- a practice being tested

## Atlas Modes

### Auto Map

Auto Map keeps the current Atlas behavior.

- Concepts appear as nodes.
- Node positions can still be moved.
- App-generated links come from shared sources, positions, inquiries, works, practices, and evidence.
- Existing `Concept.links` continue to render for backward compatibility.
- Clicking a node stays in Atlas and updates the selected-node panel.

Auto Map should remain the default Atlas view.

### Custom Maps

Custom Maps are saved user-authored maps.

Users can:

- create multiple named maps
- add concepts as nodes
- remove concepts from a map without deleting the concept itself
- drag nodes into a custom layout
- create typed user links between nodes
- write optional notes on links
- toggle auto-link overlays

Custom Maps should live inside the Atlas tab, not as a new sidebar tab.

## Firestore Additions

Add a new collection:

```txt
/users/{uid}/atlasMaps/{atlasMapId}
```

### AtlasMap

```ts
interface AtlasMap {
  id: string;
  title: string;
  description: string;
  nodeNames: string[];
  nodePositions: Record<string, AtlasMapNodePosition>;
  manualLinks: AtlasMapLink[];
  autoLinkFilters: AtlasAutoLinkFilters;
  dateCreated: string;
  dateUpdated: string;
}
```

### AtlasMapNodePosition

```ts
interface AtlasMapNodePosition {
  x: number;
  y: number;
}
```

### AtlasMapLink

```ts
interface AtlasMapLink {
  id: string;
  from: string;
  to: string;
  type:
    | 'supports'
    | 'challenges'
    | 'examples'
    | 'causes'
    | 'questions'
    | 'practices'
    | 'relates'
    | 'custom';
  label: string;
  note?: string;
  dateCreated: string;
}
```

### AtlasAutoLinkFilters

```ts
interface AtlasAutoLinkFilters {
  sharedSources: boolean;
  sharedPositions: boolean;
  sharedInquiries: boolean;
  sharedWorks: boolean;
  sharedPractices: boolean;
  conceptLinks: boolean;
}
```

## Link Types

Custom user links should be typed so the map explains why ideas connect.

Recommended link types:

- `supports`
- `challenges`
- `examples`
- `causes`
- `questions`
- `practices`
- `relates`
- `custom`

Examples:

```txt
Discipline supports Purpose
Avoidance challenges Identity
Meditations examples Self-command
Practice requires Discipline
```

## UI Changes

### Top Controls

Atlas should include:

- `Auto Map`
- `Custom Maps`
- `+ Custom Map`
- map search
- map filters

### Custom Map Controls

Custom Maps should include:

- active map selector
- map title and description editor
- `Add Node`
- `Link this idea`
- auto-link filter controls

### Selected Node Panel

When a node is selected, the side panel should show:

- selected concept name
- description
- user links
- auto-link suggestions
- linked sources
- linked inquiries
- linked positions
- linked works
- linked practices

## Linking Language Migration

Replace visible branch language with link language:

```txt
Manual Branches      -> User Links
Connect New Branch   -> Link This Idea
No manual branches   -> No user links yet
manual branch        -> user link
Branch This Concept  -> Link This Idea
Branching            -> Linking
```

Internal names can remain unchanged temporarily if renaming them creates unnecessary risk, but all user-facing language should say **link** or **linking**.

## Visual Priority

User-created links should be visually stronger than auto-generated links.

Recommended distinction:

- User links: solid line, stronger color, visible label/type.
- Auto links: lighter line, dashed or muted, filterable.

Custom maps should make the user's intentional structure feel primary. Auto-links should feel like helpful context, not the main event.

## Firestore Schema Updates

Update schema documentation and seed files to include:

```txt
/users/{uid}/atlasMaps/{atlasMapId}
```

The Firestore schema seed should create:

```txt
/users/{uid}/atlasMaps/_schema
```

The placeholder should include a sample custom map with one or two concept names and at least one typed link example.

## Implementation Notes

- Keep `Concept.links` for existing Auto Map compatibility.
- Store new user-authored map links in `AtlasMap.manualLinks`.
- Auto-link filters should hide/show auto-lines only; they should not delete data.
- Custom map node removal should remove the node from that map only, not delete the concept.
- If a concept used in a custom map is later deleted, the map should ignore or mark that missing node gracefully.

## Test Plan

- Run `npm run typecheck`.
- Run `npm run build`.
- Verify Atlas defaults to Auto Map.
- Verify Custom Maps mode can create, select, edit, and persist multiple maps.
- Verify custom maps can add and remove concept nodes without deleting concepts.
- Verify nodes can be dragged and positions persist per map.
- Verify `Link this idea` creates typed links.
- Verify link type, label, and note appear in the selected-node panel.
- Verify typed user links render stronger than auto-links.
- Verify auto-link filters toggle shared-evidence lines.
- Verify old concept links still work in Auto Map.
- Verify Firestore schema and seed script include `atlasMaps`.

## Assumptions

- Users should be able to create multiple saved custom maps.
- User-created links should be typed.
- Custom Maps belongs inside Atlas, not as a new sidebar tab.
- Existing Auto Map behavior should remain available.
- The first implementation can focus on concept nodes before supporting non-concept node types.
