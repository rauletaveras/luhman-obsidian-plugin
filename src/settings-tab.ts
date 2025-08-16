/**
 * Settings UI for the Luhmann Zettelkasten plugin.
 * 
 * This implements the settings tab that appears in Obsidian's settings panel.
 * It's pure UI code that translates between user interactions and the plugin's
 * configuration state.
 * 
 * Architecture pattern: This is a "View" in MVC terms - it displays settings
 * and captures user input, but doesn't contain business logic. All the actual
 * behavior is determined by how the main plugin interprets the settings.
 * 
 * In Rust terms, this would be like your CLI argument parsing or config file
 * UI - it just handles the interface between user and configuration.
 */

import { App, PluginSettingTab, Setting } from "obsidian";
import type NewZettel from "./main";

/**
 * Obsidian settings tab implementation.
 * 
 * Extends Obsidian's PluginSettingTab to create the UI that appears under
 * "Community plugins" -> "Luhman Remastered" in Obsidian's settings.
 * 
 * Design principle: The UI should be self-documenting. Each setting includes
 * clear descriptions of what it does and how it affects note creation.
 */
export class LuhmanSettingTab extends PluginSettingTab {
  plugin: NewZettel;

  constructor(app: App, plugin: NewZettel) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Builds the entire settings UI.
   * 
   * This method gets called whenever the settings tab is opened or refreshed.
   * We rebuild the entire UI each time to ensure it reflects current settings
   * and handles conditional sections (some settings only appear when others
   * are enabled).
   * 
   * UI Architecture:
   * 1. Core ID matching rules (always visible)
   * 2. Template settings (conditional on customTemplate)
   * 3. File naming options (conditional on matchRule)
   * 4. Linking behavior (always visible)
   * 
   * Note: We call this.display() recursively when settings change to refresh
   * conditional sections. This is simpler than manually showing/hiding elements.
   */
  display(): void {
    const { containerEl } = this;
    
    // Extract current settings for easier access
    // This destructuring pattern makes the code more readable and avoids
    // repeating this.plugin.settings everywhere
    const {
      matchRule,
      separator,
      addTitle,
      addAlias,
      useLinkAlias,
      customTemplate,
      templateFile,
      templateRequireTitle,
      templateRequireLink,
    } = this.plugin.settings;
    
    // Clear previous UI elements - we rebuild everything each time
    containerEl.empty();
    
    /**
     * Introduction text - helps users understand what IDs are.
     * 
     * This is crucial for discoverability. New users need to understand
     * the core concept before they can configure it properly.
     */
    containerEl.createEl("p", {
      text: "The ID is a block of letters and numbers at the beginning of the filename",
    });

    /**
     * Core setting: ID matching rules.
     * 
     * This is the most important setting - it determines how the plugin
     * recognizes which files are part of the zettelkasten system.
     * 
     * Business impact:
     * - "Strict": Only files like "1a2.md" are recognized
     * - "Separator": Files like "1a2 - My Note.md" are recognized  
     * - "Fuzzy": Files like "1a2_anything.md" are recognized
     */
    new Setting(containerEl)
      .setName("ID matching rule")
      .setDesc(
        "Strict means filenames consist of only an ID. " +
          "Separator means the ID must be followed by the separator. " +
          "Fuzzy treats the first non-alphanumeric character as the end of the ID."
      )
      .addDropdown((setting) =>
        setting
          .addOption("strict", "Strict")
          .addOption("separator", "Separator")
          .addOption("fuzzy", "Fuzzy")
          .setValue(matchRule)
          .onChange(async (value) => {
            // Save the new setting and refresh UI to show/hide conditional options
            this.plugin.settings.matchRule = value;
            await this.plugin.saveSettings();
            this.display(); // Refresh UI for conditional sections
          })
        );

    /**
     * Template system configuration.
     * 
     * Templates allow advanced users to customize note creation beyond the
     * built-in "# Title\n\nBacklink" format. This is a power-user feature
     * that adds complexity, so it's disabled by default.
     */
    new Setting(containerEl.createDiv())
      .setName("Use a custom template")
      .setDesc(
        "Use a custom template file for new notes"
      )
      .addToggle((setting) =>
        setting.setValue(customTemplate).onChange(async (value) => {
          this.plugin.settings.customTemplate = value;
          await this.plugin.saveSettings();
          this.display(); // Refresh to show/hide template options
        })
      );

    /**
     * Template configuration section.
     * 
     * Only shown when customTemplate is enabled. This conditional UI pattern
     * keeps the interface clean for users who don't need advanced features.
     */
    if (this.plugin.settings.customTemplate) {
      /**
       * Template file path setting.
       * 
       * Users need to specify which file to use as template. The path is
       * relative to the vault root, and the file should contain {{title}}
       * and {{link}} placeholders where content should be inserted.
       */
      new Setting(containerEl)
        .setName("Template File")
        .setDesc(
          "Set the path to a template file that is used during the creation of a new note (with file extension). " +
          "The template supported placeholders are {{title}} and {{link}} these are both space-sensitive and case-sensitive."
        )
        .addText((text) => {
          text
            .setPlaceholder("eg. /template/luhman.md")
            .setValue(templateFile)
            .onChange(async (value: string) => {
              this.plugin.settings.templateFile = value;
              await this.plugin.saveSettings();
            });
        });

      /**
       * Template validation: Title placeholder requirement.
       * 
       * Safety feature to prevent users from creating templates that don't
       * have a place for the note title. When enabled, template validation
       * will fail if {{title}} placeholder is missing.
       */
      new Setting(containerEl.createDiv())
        .setName("Require Template Title Tag")
        .setDesc(
          "Should the template file require a title tag? If not adding {{title}} to the template will be optional."
        )
        .addToggle((setting) =>
          setting.setValue(templateRequireTitle).onChange(async (value) => {
            this.plugin.settings.templateRequireTitle = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      /**
       * Template validation: Link placeholder requirement.
       * 
       * Safety feature to prevent users from creating templates that don't
       * have a place for parent backlinks. When enabled, template validation
       * will fail if {{link}} placeholder is missing.
       */
      new Setting(containerEl.createDiv())
        .setName("Require Template Link Tag")
        .setDesc(
          "Should the template file require a link tag? If not adding {{link}} to the template will be optional."
        )
        .addToggle((setting) =>
          setting.setValue(templateRequireLink).onChange(async (value) => {
            this.plugin.settings.templateRequireLink = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    /**
     * File naming options section.
     * 
     * These settings control how filenames are constructed when creating new notes.
     * Only shown for non-strict match rules, because strict mode requires
     * ID-only filenames by definition.
     * 
     * Conditional logic: matchRule !== "strict"
     */
    if (matchRule !== "strict") {
      /**
       * Automatic title inclusion in filenames.
       * 
       * When enabled: "1a2 - My Note Title.md"
       * When disabled: "1a2.md"
       * 
       * This makes files more readable in file explorers but can cause
       * issues if titles contain special characters.
       */
      new Setting(containerEl)
        .setName("Add titles automatically")
        .setDesc(
          "Add the separator and the title of the note when creating filenames"
        )
        .setDisabled(matchRule === "strict") // Redundant check, but defensive
        .addToggle((setting) =>
          setting.setValue(addTitle).onChange(async (value) => {
            this.plugin.settings.addTitle = value;
            await this.plugin.saveSettings();
            this.display(); // Refresh for separator section visibility
          })
        );

      /**
       * Frontmatter alias generation.
       * 
       * Adds YAML frontmatter with aliases array containing the note title.
       * This enables Obsidian's search to find notes by title even when
       * filenames only contain IDs.
       * 
       * Example frontmatter:
       * ---
       * aliases: ["My Note Title"]
       * ---
       */
      new Setting(containerEl)
        .setName("Add title alias to frontmatter")
        .setDesc("Add the title of the note to aliases on creation")
        .setDisabled(matchRule === "strict") // Redundant check for consistency
        .addToggle((setting) =>
          setting.setValue(addAlias).onChange(async (value) => {
            this.plugin.settings.addAlias = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

      /**
       * Link display name configuration.
       * 
       * Controls whether generated links show the title or filename:
       * - Enabled: [[1a2|My Note Title]] (prettier but can break)
       * - Disabled: [[1a2]] (always works)
       * 
       * Trade-off between readability and reliability.
       */
      new Setting(containerEl)
        .setName("Use title alias in created link")
        .setDesc("Set title as alias in created link")
        .setDisabled(matchRule === "strict") // Redundant check for consistency
        .addToggle((setting) =>
          setting.setValue(useLinkAlias).onChange(async (value) => {
            this.plugin.settings.useLinkAlias = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    /**
     * Separator configuration.
     * 
     * Only shown when separator is actually used - either when matchRule is
     * "separator" (always uses separator) or when addTitle is enabled
     * (needs separator between ID and title).
     * 
     * The separator can include whitespace for prettier filenames.
     */
    const useSeparator =
      matchRule !== "strict" && (addTitle || matchRule === "separator");

    if (useSeparator) {
      new Setting(containerEl)
        .setName("ID Separator")
        .setDesc(
          "Used between id and title, include whitespace padding if needed"
        )
        .setDisabled(!useSeparator) // Redundant but explicit
        .addText((text) =>
          text
            .setPlaceholder("Enter your separator")
            .setValue(separator)
            .onChange(async (value) => {
              this.plugin.settings.separator = value;
              await this.plugin.saveSettings();
            })
        );
    }

    /**
     * Bidirectional linking configuration.
     * 
     * These settings control the core zettelkasten feature: automatic linking
     * between parent and child notes. Both settings are always visible because
     * they're fundamental to the system's behavior.
     */

    /**
     * Parent-to-child linking.
     * 
     * When creating a child note, this controls whether a link to the child
     * gets inserted into the parent note. This maintains forward navigation
     * through the hierarchy.
     * 
     * Example: Creating child "1a1" from parent "1a" inserts "[[1a1]]" into 1a.md
     */
    new Setting(containerEl)
      .setName("Insert link in parent")
      .setDesc("When creating a child zettel, insert a link to the child in the parent zettel")
      .addToggle((setting) =>
        setting.setValue(this.plugin.settings.insertLinkInParent).onChange(async (value) => {
          this.plugin.settings.insertLinkInParent = value;
          await this.plugin.saveSettings();
        })
      );

    /**
     * Child-to-parent linking.
     * 
     * When creating a child note, this controls whether a link to the parent
     * gets inserted into the child note. This maintains backward navigation
     * through the hierarchy.
     * 
     * Example: Creating child "1a1" from parent "1a" inserts "[[1a]]" into 1a1.md
     */
    new Setting(containerEl)
      .setName("Insert link in child")
      .setDesc("When creating a child zettel, insert a link to the parent in the child zettel")
      .addToggle((setting) =>
        setting.setValue(this.plugin.settings.insertLinkInChild).onChange(async (value) => {
          this.plugin.settings.insertLinkInChild = value;
          await this.plugin.saveSettings();
        }));
  }
}
