import "./styles/styles.css";
import { IDUtils } from "./id-utils.js";

import {
  App,
  EditorPosition,
  FuzzyMatch,
  FuzzySuggestModal,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";

const checkSettingsMessage = "Try checking the settings if this seems wrong.";

interface LuhmanSettings {
  matchRule: string;
  separator: string;
  addTitle: boolean;
  addAlias: boolean;
  useLinkAlias: boolean;
  customTemplate: boolean;
  templateFile: string;
  templateRequireTitle: boolean;
  templateRequireLink: boolean;
  insertLinkInParent: boolean;
  insertLinkInChild: boolean;
}

const DEFAULT_SETTINGS: LuhmanSettings = {
  matchRule: "strict",
  addTitle: false,
  addAlias: false,
  useLinkAlias: false,
  separator: "⁝ ",
  customTemplate: false,
  templateFile: "",
  templateRequireTitle: true,
  templateRequireLink: true,
  insertLinkInParent: true,
  insertLinkInChild: true,
};

class LuhmanSettingTab extends PluginSettingTab {
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

export default class NewZettel extends Plugin {
  settings: LuhmanSettings = DEFAULT_SETTINGS;
  private idUtils!: IDUtils;

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.initializeIDUtils();
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.initializeIDUtils();
  }

// Add this new method:
  private initializeIDUtils() {
    this.idUtils = new IDUtils(
      {
        matchRule: this.settings.matchRule,
        separator: this.settings.separator,
      },
      (id: string) => this.idExistsChecker(id)
    );
  }

 // Add this helper method:
  private idExistsChecker(id: string): boolean {
    const fileMatcher = (file: TFile) => this.idUtils.fileToId(file.basename) === id;
    return this.app.vault.getMarkdownFiles().filter(fileMatcher).length != 0;
  }

// Replace the removed methods with these:
  makeNoteForNextSiblingOf(sibling: TFile): string {
    return this.idUtils.makeNoteForNextSiblingOfID(this.idUtils.fileToId(sibling.basename));
  }

  makeNoteForNextChildOf(parent: TFile): string {
    return this.idUtils.makeNoteForNextChildOfID(this.idUtils.fileToId(parent.basename));
  }

  async makeNote(
    path: string,
    title: string,
    fileLink: string,
    placeCursorAtStartOfContent: boolean,
    openZettel = false,
    successCallback: () => void = () => {
      return;
    }
  ) {
    const useTemplate =
      this.settings.customTemplate && this.settings.templateFile.trim() != "";
    const app = this.app;
    let titleContent = null;
    if (title && title.length > 0) {
      titleContent = (useTemplate == false ? "# " : "") + title.trimStart();
    } else {
      titleContent = "";
    }

    let file = null;
    const backlinkRegex = /{{link}}/g;
    const titleRegex = /{{title}}/g;
    const linkContent = this.settings.insertLinkInChild ? fileLink : "";  

    if (useTemplate) {
      let template_content = "";
      try {
        template_content = await this.app.vault.adapter.read(
          this.settings.templateFile.trim()
        );
      } catch (err) {
        new Notice(
          `[LUHMAN] Couldn't read template file. Make sure the path and file are valid/correct. Current setting: ${this.settings.templateFile.trim()}`,
          15000
        );
        return;
      }

      const testTitle =
        this.settings.templateRequireTitle == false ||
        titleRegex.test(template_content);
      const testLink =
        this.settings.templateRequireLink == false ||
        backlinkRegex.test(template_content);
      if (testTitle == false || testLink == false) {
        new Notice(
          `[LUHMAN] Template Malformed. Missing {{${testTitle ? "" : "title"}${
            testTitle == false && testLink == false ? "}} and {{" : ""
          }${testLink ? "" : "link"}}} placeholder. Please add ${
            testTitle == false && testLink == false ? "them" : "it"
          } to the template and try again...`,
          15000
        );
        return;
      }

      const file_content = template_content
        .replace(titleRegex, titleContent)
        .replace(backlinkRegex, linkContent);
      file = await this.app.vault.create(path, file_content);
      successCallback();
    } else {
      let fullContent = titleContent;
      if (linkContent.trim()) {
        fullContent += "\n\n" + linkContent;
      }
      file = await this.app.vault.create(path, fullContent);
      successCallback();
    }

    if (this.settings.addAlias && file) {
      await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
        frontMatter = frontMatter || {};
        frontMatter.aliases = frontMatter.aliases || [];
        frontMatter.aliases.push(title);
        return frontMatter;
      });
    }

    const active = app.workspace.getLeaf();
    if (active == null) {
      return;
    }
    if (openZettel == false) return;

    await active.openFile(file);

    const editor = app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (editor == null) {
      return;
    }

    if (
      placeCursorAtStartOfContent &&
      (!this.settings.customTemplate || this.settings.templateFile.trim() == "")
    ) {
      let line = 2;
      if (this.settings.addAlias) {
        line += 4;
      }
      if (this.settings.insertLinkInChild && linkContent.trim()) {
        line += 2; 
      }
      const position: EditorPosition = { line, ch: 0 };
      editor.setCursor(position);
    } else {
      editor.exec("goEnd");
    }
  }

  makeNoteFunction(idGenerator: (file: TFile) => string, openNewFile = true) {
    const file = this.app.workspace.getActiveFile();
    if (file == null) {
      return;
    }
    if (this.idUtils.isZettelFile(file.name)) {
      const fileID = this.idUtils.fileToId(file.basename);
      const fileLink = "[[" + file.basename + "]]";

      const editor =
        this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
      if (editor == null) {
        return;
      }

      const selection = editor.getSelection();

      const nextID = idGenerator.bind(this, file)();
      const nextPath = (title: string) =>
        file?.path
          ? this.app.fileManager.getNewFileParent(file.path).path +
            "/" +
            nextID +
            (this.settings.addTitle ? this.settings.separator + title : "") +
            ".md"
          : "";
      const useLinkAlias = this.settings.useLinkAlias;
      const newLink = (title: string) => {
        const alias = useLinkAlias ? `|${title}` : "";

        return `[[${nextID}${
          this.settings.addTitle ? this.settings.separator + title : ""
        }${alias}]]`;
      };

      if (selection) {
        const selectionTrimStart = selection.trimStart();
        const selectionTrimEnd = selectionTrimStart.trimEnd();
        const spaceBefore = selection.length - selectionTrimStart.length;
        const spaceAfter = selectionTrimStart.length - selectionTrimEnd.length;
        const title = selectionTrimEnd
          .split(/\s+/)
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" ");
        const selectionPos = editor!.listSelections()[0];
        /* By default the anchor is what ever position the selection started
           how ever replaceRange does not accept it both ways and
           gets weird if we just pass in the anchor then the head
           so here we create a vertual anchor and head position to pass in */
        const anchorCorrect =
          selectionPos.anchor.line == selectionPos.head.line // If the anchor and head are on the same line
            ? selectionPos.anchor.ch <= selectionPos.head.ch // Then if anchor is before the head
            : selectionPos.anchor.line < selectionPos.head.line; // else they are not on the same line and just check if anchor is before head

        const virtualAnchor = anchorCorrect
          ? selectionPos.anchor
          : selectionPos.head;
        const virtualHead = anchorCorrect
          ? selectionPos.head
          : selectionPos.anchor;

        this.makeNote(
          nextPath(title),
          title,
          fileLink,
          true,
          openNewFile,
          () => {
            // Only insert link in parent if the setting is enabled
            if (this.settings.insertLinkInParent) {
              editor!.replaceRange(
                " ".repeat(spaceBefore) + newLink(title) + " ".repeat(spaceAfter),
                virtualAnchor,
                virtualHead
              );
            }
          }
        );
      } else {
        new NewZettelModal(
          this.app,
          (title: string, options) => {
            this.makeNote(
              nextPath(title),
              title,
              fileLink,
              true,
              options.openNewZettel,
              // Only insert link in parent if the setting is enabled
              this.settings.insertLinkInParent ? this.insertTextIntoCurrentNote(newLink(title)) : () => {}
            );
          },
          {
            openNewZettel: openNewFile,
          }
        ).open();
      }
    } else {
      new Notice(
        `Couldn't find ID in "${file.basename}". ${checkSettingsMessage}`
      );
    }
  }

  async renameZettel(id: string, toId: string) {
    const sep = this.settings.separator;
    const zettel = this.app.vault
      .getMarkdownFiles()
      .filter((file) => this.idUtils.fileToId(file.basename) === id)
      .first();
    if (zettel) {
      const id = this.idUtils.fileToId(zettel.basename);
      const rest = zettel.basename.split(id)[1];
      this.app.fileManager.renameFile(
        zettel,
        zettel.parent?.path + toId + rest + "." + zettel.extension
      );
    } else {
      new Notice(`Couldn't find file for ID ${id}. ${checkSettingsMessage}`);
    }
  }

  async moveChildrenDown(id: string) {
    const children = this.getDirectChildZettels(id);
    for (const child of children) {
      await this.moveZettelDown(this.idUtils.fileToId(child.basename));
    }
  }

  async moveZettelDown(id: string) {
    this.moveChildrenDown(id);
    await this.renameZettel(id, this.idUtils.firstAvailableID(id));
  }

  async outdentZettel(id: string) {
    const newID = this.idUtils.incrementID(this.idUtils.parentID(id));
    if (this.idUtils.idExists(newID)) {
      await this.moveZettelDown(newID);
    }

    for (const child of this.getDirectChildZettels(id)) {
      const newChildID: string = this.idUtils.firstAvailableID(
        this.idUtils.firstChildOf(newID)
      );
      await this.renameZettel(this.idUtils.fileToId(child.basename), newChildID);
    }

    await this.renameZettel(id, newID);
  }

  async onload() {
    console.log("loading New Zettel");
    this.loadSettings();
    this.addSettingTab(new LuhmanSettingTab(this.app, this));
    // this.app.workspace.onLayoutReady(this.initialize);

    this.addCommand({
      id: "new-sibling-note",
      name: "New Sibling Zettel Note",
      icon: "file-symlink",
      callback: () => {
        this.makeNoteFunction(this.makeNoteForNextSiblingOf);
      },
    });

    this.addCommand({
      id: "new-child-note",
      name: "New Child Zettel Note",
      icon: "file-down",
      callback: () => {
        this.makeNoteFunction(this.makeNoteForNextChildOf);
      },
    });

    this.addCommand({
      id: "new-sibling-note-dont-open",
      name: "New Sibling Zettel Note (Don't Open)",
      icon: "file-symlink",
      callback: () => {
        this.makeNoteFunction(this.makeNoteForNextSiblingOf, false);
      },
    });

    this.addCommand({
      id: "new-child-note-dont-open",
      name: "New Child Zettel Note (Don't Open)",
      icon: "file-down",
      callback: () => {
        this.makeNoteFunction(this.makeNoteForNextChildOf, false);
      },
    });

    this.addCommand({
      id: "insert-zettel-link",
      name: "Insert Zettel Link",
      icon: "link-2",
      callback: async () => {
        // let completion = (te)
        const titles = await this.getAllNoteTitles();
        new ZettelSuggester(
          this.app,
          titles,
          this.currentlySelectedText(),
          (file) => {
            const doInsert = this.insertTextIntoCurrentNote(
              `[[${file.basename}]]`
            );
            if (doInsert == undefined)
              new Notice(
                "Error inserting link, Code: 6a46de1d-a8da-4dae-af41-9d444eaf3d4d"
              );
            else doInsert();
          }
        ).open();
      },
    });

    this.addCommand({
      id: "open-zettel",
      name: "Open Zettel",
      icon: "folder-open",
      callback: async () => {
        const titles = await this.getAllNoteTitles();

        new ZettelSuggester(
          this.app,
          titles,
          this.currentlySelectedText(),
          (file) => {
            this.app.workspace.getLeaf().openFile(file);
          }
        ).open();
      },
    });

    this.addCommand({
      id: "open-parent-zettel",
      name: "Open Parent Zettel",
      icon: "folder-open",
      callback: () => {
        const file = this.currentFile();
        if (file) {
          const id = this.idUtils.fileToId(file.basename);
          const parentId = this.idUtils.parentID(id);
          if (parentId === "") {
            new Notice(
              `No parent found for "${file.basename}". ${checkSettingsMessage}`
            );
            return;
          }
          this.openZettel(parentId);
        } else {
          new Notice("No file open");
        }
      },
    });

    this.addCommand({
      id: "outdent-zettel",
      name: "Outdent Zettel",
      icon: "outdent",
      callback: () => {
        const file = this.currentFile();
        if (file) {
          this.outdentZettel(this.idUtils.fileToId(file.basename));
        }
      },
    });
  }

  onunload() {
    console.log("unloading New Zettel");
    // this.initialize(true);
  }

  currentFile(): TFile | undefined {
    return this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
  }

  openZettel(id: string) {
    const file = this.app.vault
      .getMarkdownFiles()
      .filter((file) => this.idUtils.fileToId(file.basename) == id)
      .first();
    if (file) {
      this.app.workspace.getLeaf().openFile(file);
    }
  }

  currentlySelectedText(): string | undefined {
    return this.app.workspace
      .getActiveViewOfType(MarkdownView)
      ?.editor.getSelection();
  }

  insertTextIntoCurrentNote(text: string) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (view) {
      const editor = view!.editor;

      let position: EditorPosition;
      let prefix = "";

      if (editor.getSelection()) {
        const selectionPos = editor.listSelections()[0];
        const positionCH = Math.max(
          selectionPos.head.ch,
          selectionPos.anchor.ch
        );
        position = { line: selectionPos.anchor.line, ch: positionCH + 1 };
        prefix = " ";
      } else {
        position = editor.getCursor();
      }

      return () => {
        editor.replaceRange(prefix + text, position, position);
      };
    }
  }

  getZettels(): TFile[] {
    const fileToId = (file: TFile) => this.idUtils.fileToId(file.basename);
    return this.app.vault.getMarkdownFiles().filter((file) => {
      const ignore = !file.path.match(/^(_layouts|templates|scripts)/);
      return ignore && fileToId(file) !== "";
    });
  }

  getDirectChildZettels(ofParent: string): TFile[] {
    return this.getZettels().filter((file) => {
      return this.idUtils.parentID(this.idUtils.fileToId(file.basename)) == ofParent;
    });
  }

  async getAllNoteTitles(): Promise<Map<string, TFile>> {
    const regex = /# (.+)\s*/;
    const titles: Map<string, TFile> = new Map();
    for (const file of this.getZettels()) {
      const text = await this.app.vault.cachedRead(file);
      const match = text.match(regex);
      if (match) {
        titles.set(match[1], file);
      }
    }

    return titles;
  }
}

type ZettelModelCallback = (text: string, options: ZettelModelOptions) => void;
type ZettelModelOptions = {
  openNewZettel: boolean;
};

const MakeZettelModelOptionDefault: () => ZettelModelOptions = () => ({
  openNewZettel: true,
});

class NewZettelModal extends Modal {
  public completion: ZettelModelCallback;
  private textBox: HTMLInputElement;
  private openNewZettelCheckbox: HTMLInputElement;

  constructor(
    app: App,
    completion: ZettelModelCallback,
    options: ZettelModelOptions = MakeZettelModelOptionDefault()
  ) {
    super(app);
    this.completion = completion;

    /***********************************
     ** Model Title                   **
     ***********************************/
    const { contentEl } = this;
    contentEl.parentElement!.addClass("zettel-modal");
    this.titleEl.setText("New zettel title...");

    /***********************************
     ** Name and GO area              **
     ***********************************/

    // Setup the container
    const main_container = contentEl.createEl("div", {
      cls: "zettel-modal-container",
    });

    // Add the textBox
    this.textBox = contentEl.createEl("input", {
      type: "text",
      cls: "zettel-modal-textbox",
    });
    this.textBox.id = "zettel-modal-textbox";
    this.textBox.addEventListener("keydown", (event) => {
      if (event.key == "Enter") {
        event.preventDefault();
        this.goTapped();
      }
    });
    main_container.append(this.textBox);

    // Add the go button
    const button = contentEl.createEl("input", {
      type: "button",
      value: "GO",
      cls: "zettel-modal-button",
    });
    button.addEventListener("click", (e: Event) => this.goTapped());
    main_container.append(button);

    contentEl.append(main_container);

    /***********************************
     ** New Zettel Options            **
     ***********************************/

    // Setup the container
    const options_container = contentEl.appendChild(
      contentEl.createEl("div", {
        cls: ["zettel-modal-container", "zettel-options-container"],
      })
    );
    // Create label inside the container
    const label = options_container.appendChild(
      contentEl.createEl("label", {
        cls: ["label", "zettel-label"],
      })
    );

    // Create label
    const openNewZettelCheckboxLabel = label.appendChild(
      contentEl.createEl("div", { cls: ["labelText"] })
    );
    openNewZettelCheckboxLabel.innerText = "Open New Zettel on Creation";

    // Create checkbox inside the container
    this.openNewZettelCheckbox = label.appendChild(
      contentEl.createEl("input", {
        type: "checkbox",
        cls: ["zettel-modal-checkbox"],
        value: options.openNewZettel.toString(),
      })
    );
    this.openNewZettelCheckbox.id = "zettel-modal-option-openZettel";
    this.openNewZettelCheckbox.checked = options.openNewZettel;
  }

  onOpen() {
    window.setTimeout(() => {
      this.textBox.focus();
    }, 0);
  }

  goTapped() {
    const title = this.textBox.value;
    const openNewZettel = this.openNewZettelCheckbox.checked;
    this.completion(title, {
      openNewZettel,
    });
    this.close();
  }
}

class ZettelSuggester extends FuzzySuggestModal<string> {
  private titles: Map<string, TFile>;
  private completion: (file: TFile) => void;
  private initialQuery: string;

  constructor(
    app: App,
    titles: Map<string, TFile>,
    search: string | undefined,
    completion: (file: TFile) => void
  ) {
    super(app);
    this.initialQuery = search ?? "";
    this.titles = titles;
    this.completion = completion;
    this.emptyStateText = "No zettels found";
    this.setPlaceholder("Search for a zettel...");
    console.log(this.initialQuery);
  }

  onOpen() {
    super.onOpen();
    this.inputEl.value = this.initialQuery;
    const event = new Event("input");
    this.inputEl.dispatchEvent(event);
  }

  getItems(): string[] {
    return Array.from(this.titles.keys()).sort();
  }

  getItemText(item: string): string {
    return item;
  }

  renderSuggestion(value: FuzzyMatch<string>, el: HTMLElement) {
    el.setText(value.item);

    const matches = value.match.matches;
    if (matches == null || matches.length == 0) {
      return;
    }
    const start = matches[0][0];
    const end = matches[0][1];

    const range = new Range();

    const text = el.firstChild;
    if (text == null) {
      return;
    }

    range.setStart(text, start);
    range.setEnd(text, end);
    range.surroundContents(document.createElement("b"));
  }

  onChooseItem(item: string, evt: MouseEvent | KeyboardEvent) {
    this.completion(this.titles.get(item)!);
  }
}
