/**
 * Handles template processing and content generation.
 * 
 * This encapsulates the business rules around how note content is created,
 * whether from templates or built-in formatting.
 */
export class TemplateService {
  constructor(private settings: LuhmanSettings) {}

  /**
   * Determines if we should use custom template vs. built-in format.
   */
  shouldUseTemplate(): boolean {
    return this.settings.customTemplate && 
           this.settings.templateFile.trim() !== "";
  }

  /**
   * Validates template has required placeholders.
   * 
   * Business rule: Templates must include required placeholders
   * or explicitly disable the requirement.
   */
  validateTemplate(templateContent: string): { valid: boolean; message?: string } {
    const titleRegex = /{{title}}/g;
    const linkRegex = /{{link}}/g;
    
    const hasTitle = this.settings.templateRequireTitle === false || 
                     titleRegex.test(templateContent);
    const hasLink = this.settings.templateRequireLink === false || 
                    linkRegex.test(templateContent);

    if (!hasTitle || !hasLink) {
      const missing = [];
      if (!hasTitle) missing.push("title");
      if (!hasLink) missing.push("link");
      
      return {
        valid: false,
        message: `Template missing {{${missing.join("}} and {{")}}}} placeholder(s)`
      };
    }

    return { valid: true };
  }

  /**
   * Generates note content using template or built-in format.
   * 
   * Two business rules:
   * 1. Template mode: Replace placeholders with actual values
   * 2. Built-in mode: Create "# Title\n\nBacklink" format
   */
  generateNoteContent(
    templateContent: string | null,
    title: string,
    backlinkContent: string
  ): string {
    if (templateContent) {
      // Template mode: substitute placeholders
      return templateContent
        .replace(/{{title}}/g, title)
        .replace(/{{link}}/g, backlinkContent);
    } else {
      // Built-in mode: standard markdown format
      let content = title ? `# ${title.trimStart()}` : "";
      if (backlinkContent.trim()) {
        content += content ? "\n\n" + backlinkContent : backlinkContent;
      }
      return content;
    }
  }

  /**
   * Calculates where cursor should be positioned after note creation.
   * 
   * Business rule: Place cursor after frontmatter and content,
   * ready for user to start writing.
   */
  calculateCursorPosition(
    hasAliases: boolean,
    hasBacklink: boolean,
    isUsingTemplate: boolean
  ): { line: number; ch: number } {
    if (isUsingTemplate) {
      // Template handles positioning - just go to end
      return { line: -1, ch: -1 }; // Special value meaning "go to end"
    }

    let line = 2; // Start after "# Title" line
    
    if (hasAliases) line += 4;     // Account for YAML frontmatter
    if (hasBacklink) line += 2;    // Account for backlink + blank line
    
    return { line, ch: 0 };
  }
}
