// id-utils.ts

// Contains the refactored ID identification and manipulation functions
// from upstreams main.ts

const idOnlyRegex = /([0-9]+|[a-z]+)/g;

const lettersIDComponentSuccessors: Record<string, string> = {
  a: "b",
  b: "c",
  c: "d",
  d: "e",
  e: "f",
  f: "g",
  g: "h",
  h: "i",
  i: "j",
  j: "k",
  k: "l",
  l: "m",
  m: "n",
  n: "o",
  o: "p",
  p: "q",
  q: "r",
  r: "s",
  s: "t",
  t: "u",
  u: "v",
  v: "w",
  w: "x",
  x: "y",
  y: "z",
  z: "aa",
};

export class IDUtils {
  private settings: { matchRule: string; separator: string };
  private idExistsChecker: (id: string) => boolean;

  constructor(
    settings: { matchRule: string; separator: string },
    idExistsChecker: (id: string) => boolean
  ) {
    this.settings = settings;
    this.idExistsChecker = idExistsChecker;
  }

  incrementStringIDComponent(id: string): string {
    const comps = id.split("");
    const last = comps.pop();
    if (!last) return id; // Handle edge case
    return comps.concat([lettersIDComponentSuccessors[last]]).join("");
  }
  incrementNumberIDComponent(id: string): string {
    return (parseInt(id) + 1).toString();
  }

  isNumber(string: string): boolean {
    return /^\d+$/.test(string);
  }

  incrementIDComponent(id: string): string {
    if (this.isNumber(id)) {
      return this.incrementNumberIDComponent(id);
    } else {
      return this.incrementStringIDComponent(id);
    }
  }

  incrementID(id: string): string {
    const parts = id.match(idOnlyRegex);
    if (!parts || parts.length === 0) return id; // Handle null case
    const lastPart = parts.pop();
    if (!lastPart) return id; // Handle edge case
    return parts.concat([this.incrementIDComponent(lastPart)]).join("");
  }

  parentID(id: string): string {
    const parts = id.match(idOnlyRegex);
    if (parts && parts.length > 0) {
      parts.pop();
      return parts.join("");
    } else {
      return "";
    }
  }

  nextComponentOf(id: string): string {
    const parts = id.match(idOnlyRegex);
    if (!parts || parts.length === 0) return "a"; // Default fallback
    const lastPart = parts.pop();
    if (!lastPart) return "a"; // Default fallback
    if (this.isNumber(lastPart)) {
      return "a";
    } else {
      return "1";
    }
  }

  firstChildOf(parentID: string): string {
    return parentID + this.nextComponentOf(parentID);
  }

  fileToId(filename: string): string {
    const ruleRegexes: Record<string, RegExp> = {
      strict: /^((?:[0-9]+|[a-z]+)+)$/,
      separator: new RegExp(
        `^((?:[0-9]+|[a-z]+)+)${this.settings.separator}.*`
      ),
      fuzzy: /^((?:[0-9]+|[a-z]+)+).*/,
    };
    const match = filename.match(ruleRegexes[this.settings.matchRule]);
    if (match) {
      return match[1];
    }
    return "";
  }

  idExists(id: string): boolean {
    return this.idExistsChecker(id);
  }

  firstAvailableID(startingID: string): string {
    let nextID = startingID;
    while (this.idExists(nextID)) {
      nextID = this.incrementID(nextID);
    }
    return nextID;
  }

  // Helper methods that were used in the main class
  makeNoteForNextSiblingOfID(siblingID: string): string {
    const nextID = this.firstAvailableID(this.incrementID(siblingID));
    return nextID;
  }

  makeNoteForNextChildOfID(parentID: string): string {
    const childID = this.firstAvailableID(this.firstChildOf(parentID));
    return childID;
  }

  // Utility method to check if a filename represents a zettel
  isZettelFile(name: string): boolean {
    const mdRegex = /(.*)\.md$/;
    const matchedName = mdRegex.exec(name)?.[1] || null;
    return matchedName != null && this.fileToId(matchedName) !== "";
  }
}
