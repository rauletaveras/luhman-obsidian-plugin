import { TFile, Notice } from "obsidian";
import { IDUtils } from "./id-utils";
import type { LuhmanSettings } from "./types";

/**
 * Core business logic for Zettelkasten note operations.
 * 
 * This service handles the "what" and "why" of note creation,
 * but not the "how" of file I/O or user interaction.
 */
export class NoteService {
  constructor(
    private idUtils: IDUtils,
    private settings: LuhmanSettings
  ) {}

  /**
   * Generates the next sibling ID for a given note.
   * 
   * Sibling relationship: 1 -> 2 -> 3 (same level in hierarchy)
   * This is pure business logic - just ID manipulation.
   */
  generateSiblingId(currentFile: TFile): string {
    const currentId = this.idUtils.fileToId(currentFile.basename);
    return this.idUtils.makeNoteForNextSiblingOfID(currentId);
  }

  /**
   * Generates the next child ID for a given note.
   * 
   * Parent-child relationship: 1 -> 1a -> 1b (deeper in hierarchy)
   * Business rule: Children alternate between letters and numbers
   */
  generateChildId(parentFile: TFile): string {
    const parentId = this.idUtils.fileToId(parentFile.basename);
    return this.idUtils.makeNoteForNextChildOfID(parentId);
  }

  /**
   * Builds the complete file path for a new note.
   * 
   * Business rules encoded here:
   * - File goes in same directory as current file
   * - Filename = ID + separator + title (if enabled)
   * - Always ends with .md extension
   */
  buildNotePath(currentFile: TFile, noteId: string, title: string): string {
    const directory = currentFile.parent?.path || "";
    const separator = this.settings.addTitle ? this.settings.separator : "";
    const titlePart = this.settings.addTitle ? title : "";
    
    return `${directory}/${noteId}${separator}${titlePart}.md`;
  }

  /**
   * Creates the link text that will appear in notes.
   * 
   * Business rule: Links can optionally show custom alias text
   * Format: [[filename]] or [[filename|display text]]
   */
  buildLinkText(noteId: string, title: string): string {
    const separator = this.settings.addTitle ? this.settings.separator : "";
    const titlePart = this.settings.addTitle ? title : "";
    const alias = this.settings.useLinkAlias ? `|${title}` : "";
    
    return `[[${noteId}${separator}${titlePart}${alias}]]`;
  }

  /**
   * Processes selected text into a proper note title.
   * 
   * Business rule: Convert "hello world text" -> "Hello World Text"
   * This is domain-specific formatting logic.
   */
  processSelectedTextAsTitle(selection: string): string {
    return selection
      .trimStart()
      .trimEnd()
      .split(/\s+/)
      .map(word => word[0].toUpperCase() + word.slice(1))
      .join(" ");
  }

  /**
   * Validates that a file is a Zettel (has valid ID structure).
   * 
   * Business rule: Only notes with valid IDs participate in the system
   */
  isValidZettelFile(filename: string): boolean {
    return this.idUtils.isZettelFile(filename);
  }

  /**
   * Gets all files that are part of the Zettelkasten system.
   * 
   * Business rules:
   * - Must be markdown files
   * - Must have valid ID structure  
   * - Exclude system directories (_layouts, templates, scripts)
   */
  filterZettelFiles(allFiles: TFile[]): TFile[] {
    return allFiles.filter(file => {
      const isSystemFile = file.path.match(/^(_layouts|templates|scripts)/);
      const hasValidId = this.idUtils.fileToId(file.basename) !== "";
      
      return !isSystemFile && hasValidId;
    });
  }

  /**
   * Finds all direct children of a parent note.
   * 
   * Business rule: Child relationship is determined by ID structure
   * Parent "1a" has children "1a1", "1a2", etc. (but not "1a1a")
   */
  findDirectChildren(parentId: string, allZettels: TFile[]): TFile[] {
    return allZettels.filter(file => {
      const fileId = this.idUtils.fileToId(file.basename);
      const fileParentId = this.idUtils.parentID(fileId);
      return fileParentId === parentId;
    });
  }
}
