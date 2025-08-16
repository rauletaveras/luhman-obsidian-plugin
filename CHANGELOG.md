# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Sections are used under each version as follows:
- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be removed features.
- `Removed` for now removed features.
- `Fixed` for any bug fixes.
- `Security` in case of vulnerabilities.

## [Unreleased]

## [2.0.0] - 2025-08-15

### Major Refactor
- **BREAKING**: Complete architectural rewrite for maintainability
- Separated UI components into dedicated files (`modals.ts`, `settings-tab.ts`)
- Extracted business logic into service classes (`note-service.ts`, `template-service.ts`)
- Added comprehensive documentation and comments
- Improved error handling and user feedback

### Added
- Modular service-based architecture
- Type safety improvements
- Better separation of concerns
- Comprehensive inline documentation

### Changed
- Main plugin file reduced from 600+ to 350 lines
- Cleaner command registration and handling
- More reliable async operation handling

### Technical Improvements
- Dependency injection pattern for better testing
- Pure functions for business logic
- Consistent error handling patterns
- Service layer abstraction

## [1.x.x] - Previous Versions
See original repository history for pre-refactor changes.
