# Luhmann Remastered

Commands for handling a zettelkasten with Luhmann-style IDs (e.g: 12a56g) as filenames

## Maintenance Status
This is a community fork "maintained"
by someone who knows *just enough* TypeScript
to be dangerous.
I can:
- ✅ Merge simple bug fixes
- ✅ Update documentation
- ❌ Add complex new features
- ❌ Debug weird TypeScript issues

PRs welcome, especially from actual TypeScript developers!

AI-generated general documentation: [[documentation.md]]

### Incorporated changes from upstream:
- [PR #60: feat: Add setting to not include link in parent when creating child note](https://github.com/Dyldog/luhman-obsidian-plugin/pull/60): Addresses [#54](https://github.com/Dyldog/luhman-obsidian-plugin/issues/54)
- [Commit #80a7387](https://github.com/barnes7td/luhman-obsidian-plugin/commit/80a7387bf3b82a2f6f822b4d50ec534d4278ccbb): Fixes [#52](https://github.com/Dyldog/luhman-obsidian-plugin/issues/52)
- Addresses [#37](https://github.com/Dyldog/luhman-obsidian-plugin/issues/37)
- Addresses [#26](https://github.com/Dyldog/luhman-obsidian-plugin/issues/26)

## Commands

### Create child notes

Creates a note **under** the current note,
e.g: If run from "23f3.md", "12f3a.md" (or the next available sibling) will be created. 

If you have text selected,
that will be used as the title for your new note.
Otherwise, you will be prompted to enter a title.

### Create sibling note

Creates a note **next to** the current note,
e.g: If run from "23f3.md", "12f4.md" (or the next available sibling) will be created. 

If you have text selected,
that will be used as the title for your new note.
Otherwise, you will be prompted to enter a title.

### Open zettel

Allows you to search for files by their inner markdown title (i.e: the first H1 found within the note)

### Insert Zettel link

Lets you search by markdown titles like the "Open zettel" command above,
but inserts a link to the file instead of opening it.

## Contributors to the original project 
- [brannonh](https://github.com/brannonh)
- [eforen](https://github.com/eforen)
- [jvanz](https://github.com/jvanz)
- [pauloday](https://github.com/pauloday)
- [quarterdane](https://github.com/quarterdane)
- [barnes7td](https://github.com/barnes7td)
