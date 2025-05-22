export interface ProseMirrorNode {
  type: string;
  content?: ProseMirrorNode[];
  text?: string;
  attrs?: { [key: string]: any };
}

export interface ProseMirrorDoc {
  type: 'doc';
  content: ProseMirrorNode[];
}

export interface GranolaDoc {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
  last_viewed_panel?: {
    content?: ProseMirrorDoc;
  };
}

export interface GranolaApiResponse {
  docs: GranolaDoc[];
} 