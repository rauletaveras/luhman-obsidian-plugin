import "./styles/styles.css";
import { IDUtils } from "./id-utils.js";
import { LuhmanSettingTab } from "./settings-tab";
import { NewZettelModal, ZettelSuggester } from "./modals";
import { NoteService } from "./note-service";
import { TemplateService } from "./template-service";
import { FileOperationsService, EditorService } from "./file-operations-service";
import { DEFAULT_SETTINGS } from "./types";
import type { LuhmanSettings } from "./types";

import {
  Plugin,
  TFile,
} from "obsidian";

/**
 * NewZettel Plugin for Obsidian
 * 
 * This plugin implements a Zettelkasten note-taking system with hierarchical IDs.
 * Notes are organized by alphanumeric IDs (like 1, 1a, 1a1, 2, 2a, etc.) that
 * encode parent-child relationships.
 * 
 * Main Features:
 * - Create sibling notes (same hierarchy level): 1 -> 2 -> 3
 * - Create child notes (deeper level): 1 -> 1a -> 1b or 1a1 -> 1a2
 * - Automatic bidirectional linking between parent and child
 * - Template support for consistent note formatting
 * - Fuzzy search and navigation between notes
 * 
 * Architecture:
 * - Main plugin class orchestrates operations and handles Obsidian integration
 * - Service classes handle specific concerns (files, templates, business logic)
 * - UI components handle user interaction (modals, settings)
 * - IDUtils handles the core ID generation and parsing logic
 */
export default class NewZettel extends Plugin {
  // Plugin configuration - loaded from Obsidian's data store
  settings: LuhmanSettings = DEFAULT_SETTINGS;
  
  // Core services - these handle the actual work
  private idUtils!: IDUtils;              // ID parsing and generation
  private noteService!: NoteService;      // Business logic for note operations
  private templateService!: TemplateService;  // Template processing
  private fileOps!: FileOperationsService;    // File system operations
  private editorService!: EditorService;      // Text editor interactions

  /**
   * Plugin lifecycle: Loading settings and initializing services
   * 
   * This runs when Obsidian starts up or enables the plugin.
   * We load user settings first, then initialize all our service classes.
   */
  async loadSettings() {
    // Merge user settings with defaults (like Rust's Config::default().merge(user_config))
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.initializeServices();
  }

  /**
   * Save settings and reinitialize services.
   * 
   * Called whenever settings change. We reinitialize services because
   * some of them depend on settings (like ID matching rules).
   */
  async saveSettings() {
    await this.saveData(this.settings);
    this.initializeServices();
  }

  /**
   * Initialize all service classes with current settings.
   * 
   * This is dependency injection - we create services with their dependencies
   * rather than having them create their own. Makes testing easier.
   */
  private initializeServices() {
    // ID utilities need settings and a way to check if IDs exist
    this.idUtils = new IDUtils(
      {
        matchRule: this.settings.matchRule,
        separator: this.settings.separator,
      },
      (id: string) => this.doesIdExist(id)
    );

    // Business logic services
    this.noteService = new NoteService(this.idUtils, this.settings);
    this.templateService = new TemplateService(this.settings);
    
    // Infrastructure services
    this.fileOps = new FileOperationsService(this.app, this.settings);
    this.editorService = new EditorService(this.app);
  }

  /**
   * Check if a note with given ID already exists.
   * 
   * This is passed to IDUtils so it can generate unique IDs.
   * We search all markdown files for one with matching ID.
   */
  private doesIdExist(id: string): boolean {
    const allFiles = this.fileOps.getAllMarkdownFiles();
    return allFiles.some(file => this.idUtils.fileToId(file.basename) === id);
  }

  /**
   * Main note creation workflow.
   * 
   * This is the core operation - it coordinates between all services to:
   * 1. Process template (if using custom template)
   * 2. Create the file with proper content
   * 3. Add frontmatter aliases (if enabled)
   * 4. Open the file and position cursor
   * 5. Execute success callback (usually to insert links)
   * 
   * @param path - Full file path where note will be created
   * @param title - User-provided title for the note
   * @param parentLink - Link back to parent note (for bidirectional linking)
   * @param placeCursorAtStart - Whether to position cursor at start of content
   * @param openInEditor - Whether to open the new note in editor
   * @param onSuccess - Callback executed after successful creation (for linking)
   */
  async createNote(
    path: string,
    title: string,
    parentLink: string,
    placeCursorAtStart: boolean,
    openInEditor = false,
    onSuccess: () => void = () => {}
  ) {
    try {
      // Step 1: Determine content generation strategy
      let templateContent: string | null = null;

      if (this.templateService.shouldUseTemplate()) {
        // Using custom template - read and validate it
        try {
          templateContent = await this.fileOps.readTemplateFile(this.settings.templateFile);
          
          const validation = this.templateService.validateTemplate(templateContent);
          if (!validation.valid) {
            this.editorService.showNotice(
              `[LUHMAN] Template Malformed. ${validation.message}`,
              15000
            );
            return;
          }
        } catch (error) {
          this.editorService.showNotice(
            `[LUHMAN] ${error.message}`,
            15000
          );
          return;
        }
      }

      // Step 2: Generate note content
      const backlinkContent = this.settings.insertLinkInChild ? parentLink : "";
      const noteContent: string = this.templateService.generateNoteContent(
        templateContent,
        title,
        backlinkContent
      );

      // Step 3: Create the file
      const file = await this.fileOps.createFile(path, noteContent);
      
      // Step 4: Add aliases to frontmatter if enabled
      if (this.settings.addAlias && title) {
        await this.fileOps.addAliasToFile(file, title);
      }

      // Step 5: Execute success callback (this usually inserts parent link)
      onSuccess();

      // Step 6: Open file and position cursor if requested
      if (openInEditor) {
        await this.fileOps.openFile(file);
        
        if (placeCursorAtStart) {
          const cursorPos = this.templateService.calculateCursorPosition(
            this.settings.addAlias,
            !!backlinkContent.trim(),
            this.templateService.shouldUseTemplate()
          );
          this.editorService.setCursorPosition(cursorPos);
        }
      }
      
    } catch (error) {
      this.editorService.showNotice(
        `[LUHMAN] Failed to create note: ${error.message}`,
        10000
      );
    }
  }

  /**
   * Generic note creation function that handles both sibling and child creation.
   * 
   * This implements the common workflow:
   * 1. Validate current file is a zettel
   * 2. Generate appropriate ID (sibling or child)
   * 3. Handle text selection OR show modal for title input
   * 4. Create the note with proper linking
   * 
   * @param idGenerator - Function that generates the new note's ID
   * @param openNewFile - Whether to open the created note in editor
   */
  private executeNoteCreation(
    idGenerator: (file: TFile) => string, 
    openNewFile = true
  ) {
    // Step 1: Get and validate current file
    const currentFile = this.fileOps.getCurrentFile();
    if (!currentFile) {
      this.editorService.showNotice("No file is currently open");
      return;
    }

    if (!this.noteService.isValidZettelFile(currentFile.name)) {
      this.editorService.showNotice(
        `Couldn't find ID in "${currentFile.basename}". Try checking the settings if this seems wrong.`
      );
      return;
    }

    // Step 2: Generate new note ID and prepare linking
    const newNoteId = idGenerator(currentFile);
    const parentLink = `[[${currentFile.basename}]]`;
    
    // Helper functions for note creation
    const buildPath = (title: string) => {
      const directory = this.fileOps.getNewFileDirectory(currentFile.path);
      const separator = this.settings.addTitle ? this.settings.separator : "";
      const titlePart = this.settings.addTitle ? title : "";
      return `${directory}/${newNoteId}${separator}${titlePart}.md`;
    };

    const buildLink = (title: string) => {
      return this.noteService.buildLinkText(newNoteId, title);
    };

    // Step 3: Handle existing selection OR show modal
    const selectedText = this.editorService.getSelectedText();
    
    if (selectedText) {
      // User has text selected - use it as title and replace with link
      const title = this.noteService.processSelectedTextAsTitle(selectedText);
      
      this.createNote(
        buildPath(title),
        title,
        parentLink,
        true,
        openNewFile,
        () => {
          // Replace selected text with link (if setting enabled)
          if (this.settings.insertLinkInParent) {
            this.editorService.replaceSelection(buildLink(title));
          }
        }
      );
    } else {
      // No selection - show modal for title input
      new NewZettelModal(
        this.app,
        (title: string, options) => {
          this.createNote(
            buildPath(title),
            title,
            parentLink,
            true,
            options.openNewZettel,
            () => {
              // Insert link at cursor (if setting enabled)
              if (this.settings.insertLinkInParent) {
                const insertFunction = this.editorService.prepareTextInsertion(buildLink(title));
                insertFunction?.();
              }
            }
          );
        },
        { openNewZettel: openNewFile }
      ).open();
    }
  }

  /**
   * Hierarchy management: Moving notes and reorganizing structure
   * 
   * These operations maintain the integrity of the ID hierarchy when
   * notes are moved around. Complex because children must move with parents.
   */

  /**
   * Rename a zettel from one ID to another.
   * 
   * Preserves everything after the ID (title, extension) while changing the ID.
   * Example: "1a - My Note.md" -> "2b - My Note.md"
   */
  async renameZettel(fromId: string, toId: string) {
    const file = this.fileOps.findFile(
      file => this.idUtils.fileToId(file.basename) === fromId
    );
    
    if (file) {
      const currentId = this.idUtils.fileToId(file.basename);
      const restOfFilename = file.basename.substring(currentId.length);
      const newBasename = toId + restOfFilename;
      
      await this.fileOps.renameFile(file, newBasename);
    } else {
      this.editorService.showNotice(
        `Couldn't find file for ID ${fromId}. Try checking the settings if this seems wrong.`
      );
    }
  }

  /**
   * Move all children of a note to new IDs (recursively).
   * 
   * When we move a parent note, all its children need new IDs too.
   * This prevents ID conflicts in the hierarchy.
   */
  async moveChildrenDown(parentId: string) {
    const allZettels = this.noteService.filterZettelFiles(this.fileOps.getAllMarkdownFiles());
    const children = this.noteService.findDirectChildren(parentId, allZettels);
    
    // Move each child (which will recursively move their children)
    for (const child of children) {
      const childId = this.idUtils.fileToId(child.basename);
      await this.moveZettelDown(childId);
    }
  }

  /**
   * Move a zettel and all its children to next available IDs.
   * 
   * Used when we need to "make room" in the ID space for insertions.
   */
  async moveZettelDown(id: string) {
    await this.moveChildrenDown(id);  // Move children first
    
    const nextAvailableId = this.idUtils.firstAvailableID(id);
    await this.renameZettel(id, nextAvailableId);
  }

  /**
   * Move a note up one level in the hierarchy (outdent).
   * 
   * Example: 1a2 becomes 1b (sibling of 1a instead of child)
   * Complex because we need to handle conflicts and move children.
   */
  async outdentZettel(id: string) {
    const parentId = this.idUtils.parentID(id);
    if (!parentId) {
      this.editorService.showNotice("Note is already at top level");
      return;
    }

    // Calculate new ID (next sibling of current parent)
    const newId = this.idUtils.incrementID(parentId);
    
    // If target ID exists, move it out of the way
    if (this.doesIdExist(newId)) {
      await this.moveZettelDown(newId);
    }

    // Move all children to be children of the new ID
    const allZettels = this.noteService.filterZettelFiles(this.fileOps.getAllMarkdownFiles());
    const children = this.noteService.findDirectChildren(id, allZettels);
    
    for (const child of children) {
      const childId = this.idUtils.fileToId(child.basename);
      const newChildId = this.idUtils.firstAvailableID(
        this.idUtils.firstChildOf(newId)
      );
      await this.renameZettel(childId, newChildId);
    }

    // Finally, rename the note itself
    await this.renameZettel(id, newId);
  }

  /**
   * Navigation and search functionality
   */

  /**
   * Open a zettel by its ID.
   * 
   * Simple navigation function - finds file with given ID and opens it.
   */
  async openZettelById(id: string) {
    const file = this.fileOps.findFile(
      file => this.idUtils.fileToId(file.basename) === id
    );
    
    if (file) {
      await this.fileOps.openFile(file);
    } else {
      this.editorService.showNotice(`No zettel found with ID: ${id}`);
    }
  }

  /**
   * Get titles for all zettels by parsing their content.
   * 
   * Reads the first heading (# Title) from each zettel file.
   * Used for fuzzy search functionality.
   */
  async getAllZettelTitles(): Promise<Map<string, TFile>> {
    const titleRegex = /# (.+)\s*/;  // Matches "# Title" at start of line
    const titles: Map<string, TFile> = new Map();
    
    const allZettels = this.noteService.filterZettelFiles(
      this.fileOps.getAllMarkdownFiles()
    );
    
    for (const file of allZettels) {
      const content = await this.fileOps.readFileContent(file);
      const match = content.match(titleRegex);
      if (match) {
        titles.set(match[1], file);  // Map title -> file
      }
    }

    return titles;
  }

  /**
   * Plugin lifecycle: Register commands and initialize
   * 
   * This runs when the plugin loads. We register all the commands that
   * users can trigger via hotkeys or command palette.
   */
  async onload() {
    console.log("Loading New Zettel plugin");
    
    // Initialize settings and services
    await this.loadSettings();
    this.addSettingTab(new LuhmanSettingTab(this.app, this));

    // Note creation commands
    this.addCommand({
      id: "new-sibling-note",
      name: "New Sibling Zettel Note",
      icon: "file-symlink",
      callback: () => {
        this.executeNoteCreation(
          (file) => this.noteService.generateSiblingId(file)
        );
      },
    });

    this.addCommand({
      id: "new-child-note", 
      name: "New Child Zettel Note",
      icon: "file-down",
      callback: () => {
        this.executeNoteCreation(
          (file) => this.noteService.generateChildId(file)
        );
      },
    });

    // Note creation commands (don't open new file)
    this.addCommand({
      id: "new-sibling-note-dont-open",
      name: "New Sibling Zettel Note (Don't Open)",
      icon: "file-symlink", 
      callback: () => {
        this.executeNoteCreation(
          (file) => this.noteService.generateSiblingId(file),
          false  // Don't open new file
        );
      },
    });

    this.addCommand({
      id: "new-child-note-dont-open",
      name: "New Child Zettel Note (Don't Open)",
      icon: "file-down",
      callback: () => {
        this.executeNoteCreation(
          (file) => this.noteService.generateChildId(file),
          false  // Don't open new file
        );
      },
    });

    // Link insertion and navigation commands
    this.addCommand({
      id: "insert-zettel-link",
      name: "Insert Zettel Link",
      icon: "link-2",
      callback: async () => {
        const titles = await this.getAllZettelTitles();
        
        new ZettelSuggester(
          this.app,
          titles,
          this.editorService.getSelectedText(),
          (file) => {
            const insertFunction = this.editorService.prepareTextInsertion(
              `[[${file.basename}]]`
            );
            if (!insertFunction) {
              this.editorService.showNotice(
                "Error inserting link - no active editor"
              );
            } else {
              insertFunction();
            }
          }
        ).open();
      },
    });

    this.addCommand({
      id: "open-zettel",
      name: "Open Zettel",
      icon: "folder-open", 
      callback: async () => {
        const titles = await this.getAllZettelTitles();
        
        new ZettelSuggester(
          this.app,
          titles,
          this.editorService.getSelectedText(),
          (file) => {
            this.fileOps.openFile(file);
          }
        ).open();
      },
    });

    this.addCommand({
      id: "open-parent-zettel",
      name: "Open Parent Zettel", 
      icon: "folder-open",
      callback: () => {
        const currentFile = this.fileOps.getCurrentFile();
        if (!currentFile) {
          this.editorService.showNotice("No file open");
          return;
        }

        const currentId = this.idUtils.fileToId(currentFile.basename);
        const parentId = this.idUtils.parentID(currentId);
        
        if (!parentId) {
          this.editorService.showNotice(
            `No parent found for "${currentFile.basename}". Try checking the settings if this seems wrong.`
          );
          return;
        }

        this.openZettelById(parentId);
      },
    });

    // Hierarchy manipulation commands
    this.addCommand({
      id: "outdent-zettel",
      name: "Outdent Zettel",
      icon: "outdent",
      callback: () => {
        const currentFile = this.fileOps.getCurrentFile();
        if (currentFile) {
          const currentId = this.idUtils.fileToId(currentFile.basename);
          this.outdentZettel(currentId);
        } else {
          this.editorService.showNotice("No file open");
        }
      },
    });
  }

  /**
   * Plugin lifecycle: Cleanup
   */
  onunload() {
    console.log("Unloading New Zettel plugin");
    // No cleanup needed - Obsidian handles it
  }
}
