# LoreHub Sync Design - Final Architecture

## Overview

LoreHub sync enables sharing and synchronization of lores across devices and teams while maintaining the local-first philosophy. The design uses a workspace-based model with git as the sync backend.

## Core Concepts

### Workspaces
- **Definition**: A named collection of realms with shared sync configuration
- **Purpose**: Organize realms by how they should be synchronized
- **Naming**: User-defined, no prescriptive names (not "personal" or "company")

### Sync Repository Structure
```
~/.lorehub/sync/repos/{workspace-name}/
├── manifest.json          # Workspace metadata
├── changes/
│   └── 2024-01-15/       # Daily directories
│       ├── 1234567890-device1-create.json
│       └── 1234567891-device1-update.json
├── state/
│   ├── vector-clocks.json
│   └── last-sync.json
└── .git/                  # Git repository
```

## User Experience

### 1. Getting Started
```bash
# First time setup (creates default 'main' workspace)
$ lh init

# Create additional workspaces
$ lh workspace create shared
? Enable sync? Yes
? Repository: github.com/myteam/lorehub
✓ Created 'shared' workspace

# Link current realm to workspace
$ lh realm link shared
```

### 2. Daily Usage
```bash
# Just use lorehub normally - syncs automatically
$ lh add "Use Redis for caching"
✓ Added lore (syncing in background...)

# Manual sync when needed
$ lh sync
✓ Pulled 3 new lores
✓ Pushed 2 local changes
```

### 3. Workspace Management
```bash
# List workspaces
$ lh workspace list
┌──────────┬───────────────────────────┬─────────┬────────┐
│ Name     │ Sync                      │ Realms  │ Status │
├──────────┼───────────────────────────┼─────────┼────────┤
│ main     │ local only               │ 5       │ ✓      │
│ shared   │ github.com/team/lorehub │ 3       │ ✓      │
│ archive  │ local only               │ 12      │ ✓      │
└──────────┴───────────────────────────┴─────────┴────────┘

# Configure workspace
$ lh workspace edit shared
```

## Sync Mechanisms

### 1. Lazy Sync (Default)
- Syncs automatically when any `lh` command is run
- Checks if last sync was >5 minutes ago
- Non-blocking background operation
- Zero configuration required

### 2. Git Hooks (Optional)
- Sync on git commit/push
- Immediate propagation of changes
- Useful for team environments

### 3. OS Schedulers (Optional)
- Regular interval syncing
- Available for power users
- Platform-specific (launchd, systemd, cron)

## Implementation Strategy

### Phase 1: Core Workspace System
- [ ] Workspace CRUD operations
- [ ] Realm-to-workspace association
- [ ] Local workspace switching

### Phase 2: Git-Based Sync
- [ ] Change log generation
- [ ] Git repository management
- [ ] Push/pull operations
- [ ] Conflict detection

### Phase 3: Sync Filters
- [ ] Type-based filtering
- [ ] Confidence thresholds
- [ ] Sigil inclusion/exclusion
- [ ] Province filtering

### Phase 4: Advanced Features
- [ ] Conflict resolution UI
- [ ] Workspace templates
- [ ] Cross-workspace search
- [ ] Sync status dashboard

## Configuration Schema

```yaml
# ~/.lorehub/config.yml
defaultWorkspace: main

workspaces:
  main:
    sync: none  # local only
    
  shared:
    sync:
      repo: github.com/team/lorehub
      branch: main
      autoSync: true
      interval: 300  # seconds
    filters:
      minConfidence: 70
      types: [decree, wisdom, requirement]
      excludeSigils: [draft, personal]
    
  archive:
    sync: none
    readonly: true
```

## Key Design Decisions

1. **No Prescriptive Names**: Users define workspace names that make sense to them
2. **Git as Backend**: Leverages existing infrastructure, no custom servers needed
3. **Separate Sync Repos**: Keeps user's code repositories clean
4. **Lazy Sync by Default**: Works without configuration or background processes
5. **Progressive Enhancement**: Simple by default, powerful when needed

## Security & Privacy

- Each workspace has independent sync configuration
- Filters prevent sensitive lores from syncing
- Git's existing authentication mechanisms
- Optional encryption for sensitive workspaces

## Future Enhancements

1. **Cloud Storage Backends**: S3, GCS support
2. **P2P Sync**: Direct device-to-device sync
3. **Selective Sync**: Choose which realms to sync per device
4. **Sync Analytics**: Track sync performance and conflicts
5. **Mobile Support**: Sync to mobile devices

## Benefits

- **Local-First**: Full functionality without network
- **Flexible Organization**: Workspaces match user's mental model
- **Zero Infrastructure**: Uses existing git hosting
- **Progressive Disclosure**: Simple for beginners, powerful for experts
- **Team-Friendly**: Easy to share specific knowledge subsets