import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { LuhmanSettings } from "./types";
import type NewZettel from "./main";

export class LuhmanSettingTab extends PluginSettingTab {
  plugin: NewZettel;

  constructor(app: App, plugin: NewZettel) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
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
    containerEl.empty();
    containerEl.createEl("p", {
      text: "The ID is a block of letters and numbers at the beginning of the filename",
    });

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
            this.plugin.settings.matchRule = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );

    new Setting(containerEl.createDiv())
      .setName("Use a custom template")
      .setDesc(
        "Use a custom template file for new notes"
      )
      .addToggle((setting) =>
        setting.setValue(customTemplate).onChange(async (value) => {
          this.plugin.settings.customTemplate = value;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    if (this.plugin.settings.customTemplate) {
      new Setting(containerEl)
        .setName("Template File")
        .setDesc(
          "Set the path to a template file that is used during the creation of a new note (with file extension). The template supported placeholders are {{title}} and {{link}} these are both space-sensitive and case-sensitive."
        )
        .addText((text) => {  // Remove `: Setting` type annotation
                  text
                    .setPlaceholder("eg. /template/luhman.md")
                    .setValue(templateFile)
                    .onChange(async (value: string) => {  // Add `: string` type
                      this.plugin.settings.templateFile = value;
                      await this.plugin.saveSettings();
                    });
                });
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

    if (matchRule !== "strict") {
      new Setting(containerEl)
        .setName("Add titles automatically")
        .setDesc(
          "Add the separator and the title of the note when creating filenames"
        )
        .setDisabled(matchRule !== "strict")
        .addToggle((setting) =>
          setting.setValue(addTitle).onChange(async (value) => {
            this.plugin.settings.addTitle = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );
      new Setting(containerEl)
        .setName("Add title alias to frontmatter")
        .setDesc("Add the title of the note to aliases on creation")
        .setDisabled(matchRule !== "strict")
        .addToggle((setting) =>
          setting.setValue(addAlias).onChange(async (value) => {
            this.plugin.settings.addAlias = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );
      new Setting(containerEl)
        .setName("Use title alias in created link")
        .setDesc("Set title as alias in created link")
        .setDisabled(matchRule !== "strict")
        .addToggle((setting) =>
          setting.setValue(useLinkAlias).onChange(async (value) => {
            this.plugin.settings.useLinkAlias = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );
    }

    const useSeparator =
      matchRule !== "strict" && (addTitle || matchRule === "separator");

    if (useSeparator) {
      new Setting(containerEl)
        .setName("ID Separator")
        .setDesc(
          "Used between id and title, include whitespace padding if needed"
        )
        .setDisabled(useSeparator)
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

    new Setting(containerEl)
      .setName("Insert link in parent")
      .setDesc("When creating a child zettel, insert a link to the child in the parent zettel")
      .addToggle((setting) =>
        setting.setValue(this.plugin.settings.insertLinkInParent).onChange(async (value) => {
          this.plugin.settings.insertLinkInParent = value;
          await this.plugin.saveSettings();
        })
      );

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
