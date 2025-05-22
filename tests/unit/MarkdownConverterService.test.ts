import { MarkdownConverterService } from '../../src/services/MarkdownConverterService';
import { ProseMirrorDoc } from '../../src/types';

describe('MarkdownConverterService', () => {
  let service: MarkdownConverterService;

  beforeEach(() => {
    service = new MarkdownConverterService();
  });

  it('should return empty string for null input', () => {
    expect(service.convertProsemirrorToMarkdown(null)).toBe('');
  });

  it('should return empty string for undefined input', () => {
    expect(service.convertProsemirrorToMarkdown(undefined)).toBe('');
  });

  it('should convert heading correctly', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [{
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Test Heading' }]
      }]
    };

    expect(service.convertProsemirrorToMarkdown(doc)).toBe('## Test Heading');
  });

  it('should convert paragraph correctly', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Test paragraph' }]
      }]
    };

    expect(service.convertProsemirrorToMarkdown(doc)).toBe('Test paragraph');
  });

  it('should convert bullet list correctly', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: 'List item 1' }]
          }]
        }]
      }]
    };

    expect(service.convertProsemirrorToMarkdown(doc)).toBe('- List item 1');
  });

  it('should handle nested content correctly', () => {
    const doc: ProseMirrorDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Main Title' }]
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First paragraph' }]
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'List item 1' }]
              }]
            },
            {
              type: 'listItem',
              content: [{
                type: 'paragraph',
                content: [{ type: 'text', text: 'List item 2' }]
              }]
            }
          ]
        }
      ]
    };

    const expected = '# Main Title\n\nFirst paragraph\n\n- List item 1\n- List item 2';
    expect(service.convertProsemirrorToMarkdown(doc)).toBe(expected);
  });
}); 