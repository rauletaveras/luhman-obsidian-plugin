import { App, TFile, Notice, MarkdownView, EditorPosition } from "obsidian";
import type { LuhmanSettings } from "./types";

/**
 * Handles all file system operations and Obsidian vault interactions.
 * 
 * This is the "data access layer" - it knows HOW to interact with files
 * but doesn't know WHY (that's business logic). Think of it as the
 * equivalent of database operations in a web app.
 * 
 * In Rust terms, this is like your file I/O modules that work with
 * std::fs - pure side effects, no business decisions.
 */
export class FileOperationsService {
  constructor(
    private app: App,
    private settings: LuhmanSettings
  ) { }

  /**
   * Creates a new file with given content.
   * 
   * This is an async operation because file I/O is inherently async.
   * In Rust, this would be like tokio::fs::write().await
   * 
   * Returns the created file handle for further operations.
   */
  async createFile(path: string, content: string): Promise<TFile> {
    try {
      return await this.app.vault.create(path, content);
    } catch (_error) {
      // In Rust, we'd return Result<TFile, Error>
      // TypeScript uses exceptions instead
      throw new Error(`Failed to create file at ${path}: ${_error}`);
    }
  }

  /**
   * Reads template file content from disk.
   * 
   * Async file reading - the Promise<string> is like Future<String> in Rust.
   * We use the vault adapter which handles cross-platform file access.
   */
  async readTemplateFile(templatePath: string): Promise<string> {
    try {
      return await this.app.vault.adapter.read(templatePath.trim());
    } catch {
          // Convert file system error to user-friendly message
          throw new Error(
            `Couldn't read template file. Make sure the path and file are valid. ` +
            `Current setting: ${templatePath.trim()}`
          );
        }
      }

  /**
   * Adds frontmatter aliases to a file.
   * 
   * Frontmatter is YAML metadata at the top of markdown files:
   * ---
   * aliases: ["My Note Title"]
   * ---
   * 
   * This modifies the file in-place asynchronously.
   */
  async addAliasToFile(file: TFile, alias: string): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
      // processFrontMatter gives us a mutable object to modify
      frontMatter = frontMatter || {};  // Handle null case
      frontMatter.aliases = frontMatter.aliases || [];  // Init array if needed
      frontMatter.aliases.push(alias);
      return frontMatter;  // Return modified object
    });
  }

  /**
   * Renames a file, preserving directory structure.
   * 
   * Business logic determines the new name; this just executes the rename.
   * In Rust, this would be like std::fs::rename().
   */
  async renameFile(file: TFile, newBasename: string): Promise<void> {
    const directory = file.parent?.path || "";
    const newPath = `${directory}/${newBasename}.${file.extension}`;

    await this.app.fileManager.renameFile(file, newPath);
  }

  /**
   * Gets all markdown files in the vault.
   * 
   * This is a synchronous operation - Obsidian keeps file list in memory.
   * Similar to reading a directory in Rust, but cached for performance.
   */
  getAllMarkdownFiles(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  /**
   * Finds a file by predicate function.
   * 
   * Generic search function - the predicate determines matching logic.
   * In Rust: files.iter().find(predicate)
   */
  findFile(predicate: (file: TFile) => boolean): TFile | undefined {
    return this.getAllMarkdownFiles().find(predicate);
  }

  /**
   * Reads file content, using Obsidian's cache when possible.
   * 
   * cachedRead is performance optimization - avoids disk I/O if file
   * hasn't changed. In a Rust app, you might implement similar caching
   * with a HashMap<PathBuf, (SystemTime, String)>.
   */
  async readFileContent(file: TFile): Promise<string> {
    return await this.app.vault.cachedRead(file);
  }

  /**
   * Opens a file in the Obsidian editor.
   * 
   * This is UI interaction, but it's still "file operations" because
   * it's about file navigation, not business logic.
   */
  async openFile(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf();
    if (leaf) {
      await leaf.openFile(file);
    }
  }

  /**
   * Gets the currently active file in the editor.
   * 
   * Returns undefined if no file is open - similar to Option<T> in Rust.
   * This is reading application state, not file system.
   */
  getCurrentFile(): TFile | undefined {
    return this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
  }

  /**
   * Gets the directory where new files should be created.
   * 
   * Business rule: New files go in same directory as current file.
   * This asks Obsidian's file manager for the "new file parent".
   */
  getNewFileDirectory(currentFilePath: string): string {
    return this.app.fileManager.getNewFileParent(currentFilePath).path;
  }
}

/**
 * Handles text editor operations - cursor positioning, text insertion, etc.
 * 
 * Separated from FileOperationsService because this deals with editor state,
 * not file system operations. In a web app, this would be like DOM manipulation.
 */
export class EditorService {
  constructor(private app: App) { }

  /**
   * Gets the active markdown editor, if any.
   * 
   * Returns undefined if no editor is active - the Option<T> pattern.
   * We need the editor to manipulate text and cursor position.
   */
  private getActiveEditor() {
    return this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
  }

  /**
   * Gets currently selected text in the editor.
   * 
   * Returns undefined if nothing selected. This is read-only operation
   * that doesn't modify editor state.
   */
  getSelectedText(): string | undefined {
    const editor = this.getActiveEditor();
    return editor?.getSelection();
  }

  /**
   * Replaces selected text with new text.
   * 
   * This is the core operation for inserting links when user has text selected.
   * The spacing preservation logic maintains user's original formatting.
   */
  replaceSelection(newText: string): void {
    const editor = this.getActiveEditor();
    if (!editor) return;

    const selection = editor.getSelection();
    if (!selection) return;

    // Preserve whitespace around selection
    // "  hello world  " -> "  [[link]]  "
    const trimStart = selection.trimStart();
    const trimEnd = trimStart.trimEnd();
    const spaceBefore = selection.length - trimStart.length;
    const spaceAfter = trimStart.length - trimEnd.length;

    const selectionRange = editor.listSelections()[0];

    // Handle selection direction (user can select backwards)
    const isForward = this.isSelectionForward(selectionRange);
    const start = isForward ? selectionRange.anchor : selectionRange.head;
    const end = isForward ? selectionRange.head : selectionRange.anchor;

    const finalText = " ".repeat(spaceBefore) + newText + " ".repeat(spaceAfter);
    editor.replaceRange(finalText, start, end);
  }

  /**
   * Determines if selection was made left-to-right or right-to-left.
   * 
   * Users can drag to select in either direction. We need to know which
   * end is the "start" for text replacement.
   */
  private isSelectionForward(selection: { anchor: { line: number; ch: number }; head: { line: number; ch: number } }): boolean {
    if (selection.anchor.line === selection.head.line) {
      return selection.anchor.ch <= selection.head.ch;
    }
    return selection.anchor.line < selection.head.line;
  }

  /**
   * Inserts text at current cursor position.
   * 
   * Returns a function that, when called, performs the insertion.
   * This "delayed execution" pattern lets business logic decide when
   * to actually insert the text.
   */
  prepareTextInsertion(text: string): (() => void) | undefined {
    const editor = this.getActiveEditor();
    if (!editor) return undefined;

    // Calculate insertion position and any needed spacing
    let position: EditorPosition;
    let prefix = "";

    if (editor.getSelection()) {
      // Insert after selection
      const selectionPos = editor.listSelections()[0];
      const endCh = Math.max(selectionPos.head.ch, selectionPos.anchor.ch);
      position = { line: selectionPos.anchor.line, ch: endCh + 1 };
      prefix = " ";  // Add space before inserted text
    } else {
      // Insert at cursor
      position = editor.getCursor();
    }

    // Return function that performs the actual insertion
    return () => {
      editor.replaceRange(prefix + text, position, position);
    };
  }

  /**
   * Positions cursor at specific location in the file.
   * 
   * Used after creating new files to put cursor where user should start typing.
   * The line/ch coordinates are zero-based (like array indices).
   */
  setCursorPosition(position: EditorPosition): void {
    const editor = this.getActiveEditor();
    if (!editor) return;

    if (position.line === -1) {
      // Special case: go to end of document
      editor.exec("goEnd");
    } else {
      editor.setCursor(position);
    }
  }

  /**
   * Shows user notification message.
   * 
   * This is UI feedback, but it's so commonly used with file operations
   * that it makes sense to include here. The duration is in milliseconds.
   */
  showNotice(message: string, duration = 5000): void {
    new Notice(message, duration);
  }
}
