# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] - 2025-07-12

### Changed
- Redesigned add command UI with conversational style
  - New emoji-based prompts (📝, 📂, ✨)
  - Active field highlighting in cyan
  - Reduced vertical spacing for better information density
  - Immediate exit after successful creation
- Minimized vertical space in browse interface
  - Removed empty rows between header and data
  - More compact layout for better information density

### Added
- Distance column in search results for semantic/hybrid modes
  - Shows L2 distance metric for semantic similarity
  - Helps understand how closely results match the query

### Fixed
- Semantic search not working in interactive browse mode
  - Now properly performs semantic search when in semantic mode
  - Correctly filters results based on similarity threshold
- Hybrid search accumulation issue
  - Fixed bug where results were overwritten instead of combined
  - Now properly merges literal and semantic results
- Add command blank screen issue
  - Form now renders immediately instead of waiting for user input
  - Fixed TextInput initialization problem
- Exit behavior in add command
  - Now properly exits using process.exit instead of Ink's exit function
  - Ensures clean terminal state after adding lore

## [0.2.1] - 2025-07-09

### Changed
- **The Great Terminology Pivot** - Complete terminology overhaul for a more thematic experience:
  - Facts → Lores (pieces of wisdom and knowledge)
  - Projects → Realms (your codebases and repositories)
  - Decisions → Decrees (architectural and technical choices)
  - Todos → Quests (future actions and tasks)
  - Learnings → Lessons (discoveries and insights)
- Updated all CLI commands, UI components, and MCP tools to use new terminology
- Database remains backward compatible (migration planned for future release)

### Added
- Hybrid search functionality
  - New `--hybrid` flag that combines keyword and semantic search
  - Weighted scoring: 30% keyword + 70% semantic for better results
  - Automatically uses both search types for optimal accuracy

### Fixed
- Inline add command now works correctly
  - `lh add "lore content"` adds lore directly without interactive UI
  - Interactive mode still available with just `lh add`
- AddFact component now uses AlternativeScreenView
  - Consistent UI experience across all views
  - Dynamic terminal dimensions support
  - Clean terminal experience like other views
- Fixed embedding generation error on inline lore creation
  - Database connection now stays open until embedding completes
  - Prevents "database connection is not open" errors

### Documentation
- Updated README with new terminology throughout
- Updated MCP_USAGE.md guide with new tool names and examples
- Added "New in v0.2.1" section documenting the terminology pivot
- Updated all example commands and prompts to use new terminology

## [0.2.0] - 2025-07-09

### Added
- Similar facts navigation feature in list view
  - Display count of similar facts for each item (e.g., "10≈")
  - Press 's' to view similar facts for the selected item
  - Recursive navigation through similar facts with history
  - Press 'b' to go back in navigation history
- Alternative screen mode for cleaner terminal experience
  - Automatically enters/exits alternative screen mode
  - Hides terminal scrollback for focused interaction
- Dynamic terminal dimensions support
  - Automatically adjusts layout to terminal size
  - 60/40 split for wide screens, 50/50 for narrow screens
  - Maximizes data visibility

### Changed
- Improved layout with fixed-width formatting
  - Replaced star emoji (⭐) with bullet point (•) for predictable width
  - Moved similarity count to the left of fact text
  - Fixed-width columns for better alignment

### Fixed
- Text overflow issues that broke terminal UI layout
  - Implemented TruncatedText component for strict width enforcement
  - Removed horizontal separators that caused line wrapping
  - Fixed "Cannot access 'factsWidth' before initialization" errors
- TypeScript errors in async fact creation functions
- Navigation history type errors

## [0.1.0] - Previous release
- Initial release with core functionality