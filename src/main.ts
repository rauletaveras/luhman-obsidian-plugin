import "./styles/styles.css";
import { IDUtils } from "./id-utils";
import { LuhmanSettingTab } from "./settings-tab";
import { NewZettelModal, ZettelSuggester } from "./modals";
import { DEFAULT_SETTINGS } from "./types";
import type { LuhmanSettings } from "./types";

import {
  App,
  EditorPosition,
  MarkdownView,
  Notice,
  Plugin,
  TFile,
} from "obsidian";

const checkSettingsMessage = "Try checking the settings if this seems wrong.";

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

  private initializeIDUtils() {
    this.idUtils = new IDUtils(
      {
        matchRule: this.settings.matchRule,
        separator: this.settings.separator,
      },
      (id: string) => this.idExistsChecker(id)
    );
  }

  private idExistsChecker(id: string): boolean {
    const fileMatcher = (file: TFile) => this.idUtils.fileToId(file.basename) === id;
    return this.app.vault.getMarkdownFiles().filter(fileMatcher).length != 0;
  }

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
        const anchorCorrect =
          selectionPos.anchor.line == selectionPos.head.line
            ? selectionPos.anchor.ch <= selectionPos.head.ch
            : selectionPos.anchor.line < selectionPos.head.line;

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

  async onload() {
    console.log("loading New Zettel");
    this.loadSettings();
    this.addSettingTab(new LuhmanSettingTab(this.app, this));

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
  }
}
