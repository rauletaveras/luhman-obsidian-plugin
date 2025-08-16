# Refactored Luhman-Obsidian-Plugin

## Project Background

This plugin is a refactored fork of Dyldog/luhman-obsidian-plugin,
which seems to have been abandoned by its original maintainers.
The refactoring was done primarily by Claude Sonnet 4 for my educational purposes
and for improved maintainability.
I am currently studying the codebase to understand plugin architecture patterns.

Status: Maintains all the functionality of the original plugin,
plus some very minor fixes, but under educational review.

## Core Concepts

### Zettelkasten System

The plugin implements a hierarchical note-taking system using alphanumeric IDs:

- Siblings: Same hierarchy level (1 → 2 → 3)
- Children: Deeper level (1 → 1a → 1b, or 1a → 1a1 → 1a2)
- ID Pattern: Alternates letters/numbers for depth (1 → 1a → 1a1 → 1a1a)

### ID Matching Rules

- Strict: Filename is exactly the ID (1a2.md)
- Separator: ID followed by separator then title (1a2 - My Note.md)
- Fuzzy: ID at start, anything after first non-alphanumeric (1a2_note.md)

### Linking Behavior

- Bidirectional: Parent links to child, child links to parent (configurable)
- Templates: Support {{title}} and {{link}} placeholders
- Aliases: Can auto-generate frontmatter aliases from titles

## Architecture

### Service Layer Pattern

```
Main Plugin (Orchestration)
├── NoteService (Business Logic)
├── TemplateService (Content Generation)
├── FileOperationsService (File I/O)
├── EditorService (Text Manipulation)
├── IDUtils (ID Parsing/Generation)
└── UI Components (Modals, Settings)
```

### Key services

**IDUtils:** Core ID manipulation

- Parse filenames to extract IDs
- Generate next sibling/child IDs
- Handle ID validation and conflicts

**NoteService:** Business logic

- Determine file paths and link formats
- Validate zettel files
- Process selected text into titles

**TemplateService:** Content generation

- Template validation and processing
- Calculate cursor positioning
- Handle built-in vs custom formatting

**FileOperationsService:** File system operations

- Create/rename/read files
- Handle frontmatter manipulation
- Manage file navigation

**EditorService:** Text editor integration

- Text selection and replacement
- Cursor positioning
- User notifications

### Data flow

1. User triggers command → Main plugin validates context
1. Service layer generates IDs/paths/content → File operations execute
1. Success callbacks handle linking → Editor positions cursor

## Development guide

### Project structure

```
src/
├── main.ts              # Plugin orchestration and commands
├── id-utils.ts          # Core ID logic
├── note-service.ts      # Business logic
├── template-service.ts  # Template processing
├── file-operations-service.ts # File I/O and editor
├── settings-tab.ts      # Settings UI
├── modals.ts           # User input dialogs
└── types.ts            # TypeScript interfaces
```

### Key extension points

Adding Commands: Register in `main.ts onload()` method

```typescript
this.addCommand({
  id: "my-command",
  name: "My Command",
  callback: () => this.myFunction(),
});
```

Modifying ID Logic: Extend `IDUtils` class methods

Changing Templates: Modify `TemplateService.generateNoteContent()`

File Operations: Extend `FileOperationsService` methods

### Settings configuration

Settings are defined in `types.ts` and managed through:

- `LuhmanSettings` interface
- `DEFAULT_SETTINGS` constant
- `LuhmanSettingTab` UI class

### Common patterns

- **Error Handling:** Services throw errors, main plugin catches and shows notices
- **Async Operations:** File I/O uses async/await pattern
- **Dependency Injection:** Services receive dependencies in constructors
- **Optional Operations:** Use `?.` for null-safe property access
