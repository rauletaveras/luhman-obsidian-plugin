import type { TFile } from "obsidian";

export interface LuhmanSettings {
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

export const DEFAULT_SETTINGS: LuhmanSettings = {
  matchRule: "strict",
  addTitle: false,
  addAlias: false,
  useLinkAlias: false,
  separator: "â ",
  customTemplate: false,
  templateFile: "",
  templateRequireTitle: true,
  templateRequireLink: true,
  insertLinkInParent: true,
  insertLinkInChild: true,
};

export type ZettelModelCallback = (text: string, options: ZettelModelOptions) => void;

export type ZettelModelOptions = {
  openNewZettel: boolean;
};
