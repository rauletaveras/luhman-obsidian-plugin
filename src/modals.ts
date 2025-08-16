import { App, FuzzyMatch, FuzzySuggestModal, Modal, TFile } from "obsidian";
import type { ZettelModelCallback, ZettelModelOptions } from "./types";

const MakeZettelModelOptionDefault: () => ZettelModelOptions = () => ({
  openNewZettel: true,
});

export class NewZettelModal extends Modal {
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

export class ZettelSuggester extends FuzzySuggestModal<string> {
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
