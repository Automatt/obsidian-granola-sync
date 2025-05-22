import { IMarkdownConverter } from '../interfaces';
import { ProseMirrorDoc, ProseMirrorNode } from '../types';

export class MarkdownConverterService implements IMarkdownConverter {
  convertProsemirrorToMarkdown(doc: ProseMirrorDoc | null | undefined): string {
    if (!doc || doc.type !== 'doc' || !doc.content) {
      return "";
    }

    let markdownOutput: string[] = [];

    const processNode = (node: ProseMirrorNode): string => {
      if (!node || typeof node !== 'object') return "";

      let textContent = "";
      if (node.content && Array.isArray(node.content)) {
        textContent = node.content.map(processNode).join('');
      } else if (node.text) {
        textContent = node.text;
      }

      switch (node.type) {
        case 'heading':
          const level = node.attrs?.level || 1;
          return `${'#'.repeat(level)} ${textContent.trim()}\n\n`;
        case 'paragraph':
          const trimmedContent = textContent.trim();
          return trimmedContent ? `${trimmedContent}\n\n` : "";
        case 'bulletList':
          if (!node.content) return "";
          const items = node.content.map(itemNode => {
            if (itemNode.type === 'listItem') {
              const listItemContent = (itemNode.content || []).map(processNode).join('').trim();
              return `- ${listItemContent}`;
            }
            return '';
          }).filter(item => item.length > 0);
          return items.join('\n') + (items.length > 0 ? '\n\n' : "");
        case 'text':
          return node.text || "";
        default:
          return textContent;
      }
    };

    doc.content.forEach(node => {
      markdownOutput.push(processNode(node));
    });
    
    return markdownOutput.join('').replace(/\n{3,}/g, '\n\n').trim();
  }
} 