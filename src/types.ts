/**
 * Type definitions and configuration interfaces for the Luhmann Zettelkasten system.
 * 
 * This file defines the core data structures that govern how the plugin behaves.
 * Think of these as the "configuration schema" - they define what settings are
 * available and how UI components communicate with each other.
 * 
 * In Rust terms, these are like your Config structs and enum variants that
 * define the shape of your application state.
 */

/**
 * Main plugin configuration interface.
 * 
 * This defines all user-configurable settings that control plugin behavior.
 * Each setting corresponds to a UI control in the settings tab and affects
 * how notes are created, linked, and organized.
 * 
 * Design principle: All behavior should be configurable rather than hardcoded.
 * This makes the plugin adaptable to different user workflows.
 */
export interface LuhmanSettings {
  /**
   * How strictly to match IDs in filenames.
   * 
   * Business rules for ID extraction:
   * - "strict": Filename must be exactly the ID (e.g., "1a2.md")
   * - "separator": ID followed by separator then title (e.g., "1a2 - My Note.md")  
   * - "fuzzy": ID at start, anything after first non-alphanumeric (e.g., "1a2_note.md")
   * 
   * This affects both ID parsing and filename generation.
   */
  matchRule: string;

  /**
   * String used to separate ID from title in filenames.
   * 
   * Examples: " - ", " ", "_", etc.
   * Only used when matchRule is "separator" or when addTitle is true.
   * Can include whitespace for prettier filenames.
   */
  separator: string;

  /**
   * Whether to include note title in the filename.
   * 
   * When true: "1a2 - My Note Title.md"
   * When false: "1a2.md"
   * 
   * Disabled for "strict" match rule to maintain ID-only filenames.
   */
  addTitle: boolean;

  /**
   * Whether to add note title as an alias in frontmatter.
   * 
   * Frontmatter aliases allow Obsidian to find notes by their titles:
   * ---
   * aliases: ["My Note Title"]
   * ---
   * 
   * This enables title-based search even with ID-only filenames.
   */
  addAlias: boolean;

  /**
   * Whether to use title as display text in generated links.
   * 
   * When true: [[1a2|My Note Title]] (shows title, links to file)
   * When false: [[1a2]] (shows filename)
   * 
   * Makes links more readable but may break if files are renamed.
   */
  useLinkAlias: boolean;

  /**
   * Whether to use custom template files for note creation.
   * 
   * When false: Uses built-in format (# Title\n\nBacklink)
   * When true: Reads template from templateFile path
   * 
   * Templates support {{title}} and {{link}} placeholders.
   */
  customTemplate: boolean;

  /**
   * Path to template file used for note creation.
   * 
   * Must be valid file path relative to vault root.
   * Example: "templates/zettel-template.md"
   * 
   * Only used when customTemplate is true.
   */
  templateFile: string;

  /**
   * Whether template validation requires {{title}} placeholder.
   * 
   * When true: Template must contain {{title}} or validation fails
   * When false: {{title}} placeholder is optional
   * 
   * Safety feature to prevent creating notes without title insertion point.
   */
  templateRequireTitle: boolean;

  /**
   * Whether template validation requires {{link}} placeholder.
   * 
   * When true: Template must contain {{link}} or validation fails  
   * When false: {{link}} placeholder is optional
   * 
   * Safety feature to prevent creating notes without backlink insertion point.
   */
  templateRequireLink: boolean;

  /**
   * Whether to insert link to child note in parent when creating children.
   * 
   * Implements bidirectional linking: when you create child "1a1" from parent "1a",
   * this controls whether "[[1a1]]" gets inserted into the parent note.
   * 
   * Core zettelkasten feature - maintains connection visibility.
   */
  insertLinkInParent: boolean;

  /**
   * Whether to insert link to parent note in child when creating children.
   * 
   * Implements bidirectional linking: when you create child "1a1" from parent "1a",
   * this controls whether "[[1a]]" gets inserted into the child note.
   * 
   * Enables easy navigation back up the hierarchy.
   */
  insertLinkInChild: boolean;
}

/**
 * Default configuration values.
 * 
 * These represent sensible defaults for new users. The design philosophy:
 * - Conservative defaults that work for most users
 * - Enable core zettelkasten features (bidirectional linking)
 * - Avoid complex features (templates) by default
 * - Use readable separators and strict ID matching for simplicity
 * 
 * Note: The separator "â " appears to be a Unicode character - this might
 * be an encoding artifact. In production, consider using " - " instead.
 */
export const DEFAULT_SETTINGS: LuhmanSettings = {
  matchRule: "strict",              // Simple ID-only filenames by default
  addTitle: false,                  // Keep filenames clean initially
  addAlias: false,                  // Minimal frontmatter by default
  useLinkAlias: false,             // Show actual filenames in links
  separator: "â ",                 // Pretty separator when titles are enabled
  customTemplate: false,           // Use built-in formatting
  templateFile: "",                // No template file initially
  templateRequireTitle: true,      // Safety: templates should handle titles
  templateRequireLink: true,       // Safety: templates should handle backlinks
  insertLinkInParent: true,        // Core zettelkasten: bidirectional linking
  insertLinkInChild: true,         // Core zettelkasten: bidirectional linking
};

/**
 * Callback function type for note creation modals.
 * 
 * This defines the interface between UI components (modals) and business logic.
 * When user completes note creation dialog, this function gets called with
 * the entered title and any additional options.
 * 
 * @param text - User-entered title for the new note
 * @param options - Additional creation options (like whether to open the note)
 */
export type ZettelModelCallback = (text: string, options: ZettelModelOptions) => void;

/**
 * Options that can be configured during note creation.
 * 
 * This allows the note creation modal to offer additional choices beyond
 * just the note title. Currently supports controlling whether the new
 * note should be opened in the editor after creation.
 * 
 * Extensible design: additional options can be added here as features evolve.
 */
export type ZettelModelOptions = {
  /**
   * Whether to open the newly created note in the editor.
   * 
   * When true: Note is created and immediately opened for editing
   * When false: Note is created but current file remains active
   * 
   * Useful for rapid note creation without losing context.
   */
  openNewZettel: boolean;
};
