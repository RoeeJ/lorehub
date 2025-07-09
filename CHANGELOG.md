# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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