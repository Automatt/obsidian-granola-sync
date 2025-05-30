import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  requestUrl,
  normalizePath,
} from "obsidian";
import {
  createDailyNote,
  getDailyNote,
  getAllDailyNotes,
  getDailyNoteSettings,
} from "obsidian-daily-notes-interface";
import { updateSection } from "./textUtils";
import {
  GranolaSyncSettings,
  DEFAULT_SETTINGS,
  GranolaSyncSettingTab,
} from "./settings";
import moment from "moment";

// Helper interfaces for ProseMirror and API responses
interface ProseMirrorNode {
  type: string;
  content?: ProseMirrorNode[];
  text?: string;
  attrs?: { [key: string]: any };
}

interface ProseMirrorDoc {
  type: "doc";
  content: ProseMirrorNode[];
}

interface GranolaDoc {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
  last_viewed_panel?: {
    content?: ProseMirrorDoc;
  };
}

interface GranolaApiResponse {
  docs: GranolaDoc[];
}

export default class GranolaSync extends Plugin {
  settings: GranolaSyncSettings;
  syncIntervalId: number | null = null;
  accessToken: string | null = null;
  tokenLoadError: string | null = null;

  async onload() {
    await this.loadSettings();
    await this.loadCredentials();

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText("Granola Sync Idle"); // Updated status bar text

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: "sync-granola-notes",
      name: "Sync Notes from Granola", // Updated command name
      callback: async () => {
        new Notice("Granola Sync: Starting manual sync...");
        statusBarItemEl.setText("Granola Sync: Syncing...");

        await this.syncGranolaNotes();
        await this.syncGranolaTranscripts();
        statusBarItemEl.setText(
          `Granola Sync: Last synced ${new Date(
            this.settings.latestSyncTime
          ).toLocaleString()}`
        );
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new GranolaSyncSettingTab(this.app, this));

    // Setup periodic sync based on settings
    this.setupPeriodicSync();

    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    // Example: this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
    // We handle our interval manually with setupPeriodicSync and clearPeriodicSync
  }

  onunload() {
    this.clearPeriodicSync();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    await this.loadCredentials();
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Re-evaluate periodic sync when settings change (e.g., interval or enabled status)
    await this.loadCredentials();
    this.setupPeriodicSync();
  }

  async loadCredentials() {
    this.accessToken = null;
    this.tokenLoadError = null;
    try {
      if (!this.settings.tokenPath) {
        this.tokenLoadError = "Token path is not configured in settings.";
        return;
      }
      if (
        this.settings.tokenPath.startsWith("/") ||
        this.settings.tokenPath.match(/^[A-Za-z]:\\/)
      ) {
        this.tokenLoadError =
          "Token path appears to be an absolute path. Please ensure it's a path relative to your vault root, e.g., 'configs/supabase.json'. Plugins typically cannot access arbitrary file system locations.";
        return;
      }
      if (
        !(await this.app.vault.adapter.exists(
          normalizePath(this.settings.tokenPath)
        ))
      ) {
        this.tokenLoadError = `Credentials file not found at '${this.settings.tokenPath}'. Please check the path in settings.`;
        return;
      }
      const tokenFileContent = await this.app.vault.adapter.read(
        normalizePath(this.settings.tokenPath)
      );
      try {
        const tokenData = JSON.parse(tokenFileContent);
        const cognitoTokens = JSON.parse(tokenData.cognito_tokens); // Assuming cognito_tokens is a stringified JSON
        this.accessToken = cognitoTokens.access_token;
        if (!this.accessToken) {
          this.tokenLoadError =
            "No access token found in credentials file. The token may have expired.";
        }
      } catch (parseError) {
        this.tokenLoadError =
          "Invalid JSON format in credentials file. Please ensure the file is properly formatted.";
        console.error("Token file parse error:", parseError);
      }
    } catch (error) {
      this.tokenLoadError =
        "Failed to load credentials. Please check if the file exists and is accessible.";
      console.error("Credentials loading error:", error);
    }
  }

  setupPeriodicSync() {
    this.clearPeriodicSync(); // Clear any existing interval first
    if (this.settings.isSyncEnabled && this.settings.syncInterval > 0) {
      this.syncIntervalId = window.setInterval(async () => {
        const statusBarItemEl = this.app.workspace.containerEl.querySelector(
          ".status-bar-item .status-bar-item-segment"
        );
        if (statusBarItemEl)
          statusBarItemEl.setText("Granola Sync: Auto-syncing...");
        await this.syncGranolaNotes();
        if (statusBarItemEl)
          statusBarItemEl.setText(
            `Granola Sync: Last synced ${new Date(
              this.settings.latestSyncTime
            ).toLocaleString()}`
          );
      }, this.settings.syncInterval * 1000);
      this.registerInterval(this.syncIntervalId); // Register with Obsidian to auto-clear on disable
    }
  }

  clearPeriodicSync() {
    if (this.syncIntervalId !== null) {
      window.clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  // Helper to escape strings for use in regex
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
  }

  private sanitizeFilename(title: string): string {
    const invalidChars = /[<>:"/\\|?*]/g;
    let filename = title.replace(invalidChars, "");
    filename = filename.replace(/\s+/g, "_"); // Replace one or more spaces with a single underscore
    // Truncate filename if too long (e.g., 200 chars, common limit)
    const maxLength = 200;
    if (filename.length > maxLength) {
      filename = filename.substring(0, maxLength);
    }
    return filename;
  }

  // Compute the folder path for a note based on daily note settings
  private computeDailyNoteFolderPath(noteDate: Date): string {
    const dailyNoteSettings = getDailyNoteSettings();
    const noteMoment = moment(noteDate);

    // Format the date according to the daily note format
    const formattedPath = noteMoment.format(
      dailyNoteSettings.format || "YYYY-MM-DD"
    );

    // Extract just the folder part (everything except the filename)
    const pathParts = formattedPath.split("/");
    const folderParts = pathParts.slice(0, -1); // Remove the last part (filename)

    // Combine with the base daily notes folder
    const baseFolder = dailyNoteSettings.folder || "";
    if (folderParts.length > 0) {
      return normalizePath(`${baseFolder}/${folderParts.join("/")}`);
    } else {
      return normalizePath(baseFolder);
    }
  }

  private convertProsemirrorToMarkdown(
    doc: ProseMirrorDoc | null | undefined
  ): string {
    if (!doc || doc.type !== "doc" || !doc.content) {
      return "";
    }

    let markdownOutput: string[] = [];

    const processNode = (node: ProseMirrorNode): string => {
      if (!node || typeof node !== "object") return "";

      let textContent = "";
      if (node.content && Array.isArray(node.content)) {
        textContent = node.content.map(processNode).join("");
      } else if (node.text) {
        textContent = node.text;
      }

      switch (node.type) {
        case "heading":
          const level = node.attrs?.level || 1;
          return `${"#".repeat(level)} ${textContent.trim()}\n\n`;
        case "paragraph":
          // Ensure paragraphs are separated by exactly one blank line from previous content
          // unless they are empty.
          const trimmedContent = textContent.trim();
          return trimmedContent ? `${trimmedContent}\n\n` : "";
        case "bulletList":
          if (!node.content) return "";
          const items = node.content
            .map((itemNode) => {
              if (itemNode.type === "listItem") {
                const listItemContent = (itemNode.content || [])
                  .map(processNode)
                  .join("")
                  .trim();
                return `- ${listItemContent}`;
              }
              return "";
            })
            .filter((item) => item.length > 0);
          return items.join("\n") + (items.length > 0 ? "\n\n" : "");
        case "text":
          return node.text || "";
        default:
          return textContent;
      }
    };

    doc.content.forEach((node) => {
      markdownOutput.push(processNode(node));
    });

    // Post-processing: Remove excessive newlines, ensure at most two newlines between blocks
    return markdownOutput
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  private async checkCredentials(): Promise<string | null> {
    if (this.tokenLoadError) {
      new Notice(`Granola Sync Error: ${this.tokenLoadError}`, 10000);
      return null;
    }
    if (!this.accessToken) {
      new Notice("Granola Sync Error: No access token loaded.", 10000);
      return null;
    }
    return this.accessToken;
  }

  private async fetchDocuments(
    accessToken: string
  ): Promise<GranolaDoc[] | null> {
    try {
      const response = await requestUrl({
        url: "https://api.granola.ai/v2/get-documents",
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "*/*",
          "User-Agent": "GranolaObsidianPlugin/0.1.7",
          "X-Client-Version": "ObsidianPlugin-0.1.7",
        },
        body: JSON.stringify({
          limit: 100,
          offset: 0,
          include_last_viewed_panel: true,
        }),
        throw: true,
      });

      const apiResponse = response.json as GranolaApiResponse;
      if (!apiResponse || !apiResponse.docs) {
        new Notice(
          "Granola Sync Error: Invalid API response format. Please try again later.",
          10000
        );
        return null;
      }
      return apiResponse.docs;
    } catch (error: any) {
      if (error.status === 401) {
        new Notice(
          "Granola Sync Error: Authentication failed. Your access token may have expired. Please update your credentials file.",
          10000
        );
      } else if (error.status === 403) {
        new Notice(
          "Granola Sync Error: Access forbidden. Please check your permissions.",
          10000
        );
      } else if (error.status === 404) {
        new Notice(
          "Granola Sync Error: API endpoint not found. Please check for updates.",
          10000
        );
      } else if (error.status >= 500) {
        new Notice(
          "Granola Sync Error: Granola API server error. Please try again later.",
          10000
        );
      } else {
        new Notice(
          "Granola Sync Error: Failed to fetch documents from Granola API. Please check your internet connection.",
          10000
        );
      }
      console.error("API request error:", error);
      return null;
    }
  }

  private async ensureFolderExists(folderPath: string): Promise<boolean> {
    try {
      if (!(await this.app.vault.adapter.exists(folderPath))) {
        await this.app.vault.createFolder(folderPath);
      }
      return true;
    } catch (error) {
      new Notice(
        `Granola Sync Error: Could not create folder '${folderPath}'. Check console.`,
        10000
      );
      console.error("Folder creation error:", error);
      return false;
    }
  }

  private formatTranscriptBySpeaker(
    transcriptData: Array<{
      document_id: string;
      start_timestamp: string;
      text: string;
      source: string;
      id: string;
      is_final: boolean;
      end_timestamp: string;
    }>,
    title: string
  ): string {
    let transcriptMd = `# Transcript for: ${title}\n\n`;
    let currentSpeaker: string | null = null;
    let currentStart: string | null = null;
    let currentText: string[] = [];
    const getSpeaker = (source: string) =>
      source === "microphone" ? "Tom Elliot" : "Guest";

    for (let i = 0; i < transcriptData.length; i++) {
      const entry = transcriptData[i];
      const speaker = getSpeaker(entry.source);

      if (currentSpeaker === null) {
        currentSpeaker = speaker;
        currentStart = entry.start_timestamp;
        currentText = [entry.text];
      } else if (speaker === currentSpeaker) {
        currentText.push(entry.text);
      } else {
        // Write previous block
        transcriptMd += `## ${currentSpeaker} (${currentStart})\n\n`;
        transcriptMd += currentText.join(" ") + "\n\n";
        // Start new block
        currentSpeaker = speaker;
        currentStart = entry.start_timestamp;
        currentText = [entry.text];
      }
    }

    // Write last block
    if (currentSpeaker !== null) {
      transcriptMd += `## ${currentSpeaker} (${currentStart})\n\n`;
      transcriptMd += currentText.join(" ") + "\n\n";
    }

    return transcriptMd;
  }

  async syncGranolaNotes() {
    new Notice("Granola Sync: Starting sync...", 5000);

    // Check credentials
    const accessToken = await this.checkCredentials();
    if (!accessToken) return;

    // Fetch documents
    const documents = await this.fetchDocuments(accessToken);
    if (!documents) return;

    // Check folder configuration
    if (
      !this.settings.granolaFolder &&
      !this.settings.syncToDailyNotes &&
      !this.settings.useDailyNoteFolderStructure
    ) {
      new Notice(
        "Granola Sync Error: No folder configuration set. Please configure either a Granola folder, enable sync to daily notes, or use daily note folder structure.",
        10000
      );
      return;
    }

    const granolaFolderPath = normalizePath(this.settings.granolaFolder);

    // Create folder if needed
    if (
      !this.settings.syncToDailyNotes &&
      !this.settings.useDailyNoteFolderStructure
    ) {
      if (!(await this.ensureFolderExists(granolaFolderPath))) return;
    }

    let syncedCount = 0;

    if (this.settings.syncToDailyNotes) {
      const dailyNotesMap: Map<
        string,
        {
          title: string;
          docId: string;
          createdAt?: string;
          updatedAt?: string;
          markdown: string;
        }[]
      > = new Map();

      for (const doc of documents) {
        const title = doc.title || "Untitled Granola Note";
        const docId = doc.id || "unknown_id";
        const contentToParse = doc.last_viewed_panel?.content;

        if (!contentToParse || contentToParse.type !== "doc") {
          continue;
        }
        const markdownContent =
          this.convertProsemirrorToMarkdown(contentToParse);

        let noteDateSource: Date;
        if (doc.created_at) noteDateSource = new Date(doc.created_at);
        else if (doc.updated_at) noteDateSource = new Date(doc.updated_at);
        else noteDateSource = new Date();

        const noteMoment = moment(noteDateSource);
        const mapKey = noteMoment.format("YYYY-MM-DD"); // Use date string as key

        if (!dailyNotesMap.has(mapKey)) {
          dailyNotesMap.set(mapKey, []);
        }
        dailyNotesMap.get(mapKey)?.push({
          title,
          docId,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
          markdown: markdownContent,
        });
      }

      const sectionHeadingSetting =
        this.settings.dailyNoteSectionHeading.trim(); // Trim the setting value

      for (const [dateKey, notesForDay] of dailyNotesMap) {
        const noteMoment = moment(dateKey, "YYYY-MM-DD");
        let dailyNoteFile = getDailyNote(noteMoment, getAllDailyNotes());

        if (!dailyNoteFile) {
          dailyNoteFile = await createDailyNote(noteMoment);
        }

        let fullSectionContent = sectionHeadingSetting; // Use trimmed version here
        if (notesForDay.length > 0) {
          // Only add note content if there are notes
          for (const note of notesForDay) {
            // Each note block starts with a newline, ensuring separation from heading or previous note
            fullSectionContent += `\n### ${note.title}\n`;
            fullSectionContent += `**Granola ID:** ${note.docId}\n`;
            if (note.createdAt)
              fullSectionContent += `**Created:** ${note.createdAt}\n`;
            if (note.updatedAt)
              fullSectionContent += `**Updated:** ${note.updatedAt}\n`;
            fullSectionContent += `\n${note.markdown}\n`;
          }
        } else {
          // If there are no notes for the day, the section will just be the heading.
        }

        // Prepare the final content for the section, ensuring it ends with a single newline.
        const completeSectionText = fullSectionContent.trim() + "\n";

        // Use updateSection from textUtils.ts
        try {
          await updateSection(
            this.app,
            dailyNoteFile,
            sectionHeadingSetting,
            completeSectionText
          );
        } catch (error) {
          new Notice(
            `Error updating section in ${dailyNoteFile.path}. Check console.`,
            7000
          );
        }

        syncedCount += notesForDay.length;
      }
    } else {
      // Original logic for syncing to individual files
      for (const doc of documents) {
        const title = doc.title || "Untitled Granola Note";
        const docId = doc.id || "unknown_id";

        const contentToParse = doc.last_viewed_panel?.content;
        if (!contentToParse || contentToParse.type !== "doc") {
          continue;
        }

        try {
          const markdownContent =
            this.convertProsemirrorToMarkdown(contentToParse);
          const escapedTitleForYaml = title.replace(/"/g, '\\"');

          const frontmatterLines = [
            "---",
            `granola_id: ${docId}`,
            `title: "${escapedTitleForYaml}"`,
          ];
          if (doc.created_at)
            frontmatterLines.push(`created_at: ${doc.created_at}`);
          if (doc.updated_at)
            frontmatterLines.push(`updated_at: ${doc.updated_at}`);
          frontmatterLines.push("---", "");

          const finalMarkdown = frontmatterLines.join("\n") + markdownContent;
          const filename = this.sanitizeFilename(title) + ".md";

          // Determine the folder path based on settings
          let folderPath: string;
          if (this.settings.useDailyNoteFolderStructure) {
            // Get the note date
            let noteDate: Date;
            if (doc.created_at) noteDate = new Date(doc.created_at);
            else if (doc.updated_at) noteDate = new Date(doc.updated_at);
            else noteDate = new Date();

            // Compute folder path based on daily note settings
            folderPath = this.computeDailyNoteFolderPath(noteDate);

            // Ensure the folder exists
            if (!(await this.ensureFolderExists(folderPath))) {
              new Notice(
                `Error creating folder: ${folderPath}. Skipping note: ${title}`,
                7000
              );
              continue;
            }
          } else {
            // Use the configured Granola folder
            folderPath = granolaFolderPath;
          }

          const filePath = normalizePath(`${folderPath}/${filename}`);

          await this.app.vault.adapter.write(filePath, finalMarkdown);
          syncedCount++;
        } catch (e) {
          new Notice(
            `Error processing document: ${title}. Check console.`,
            7000
          );
        }
      }
    }

    this.settings.latestSyncTime = Date.now();
    await this.saveSettings(); // Save settings to persist latestSyncTime

    let locationMessage: string;
    if (this.settings.syncToDailyNotes) {
      locationMessage = "daily notes";
    } else if (this.settings.useDailyNoteFolderStructure) {
      locationMessage = "daily note folder structure";
    } else {
      locationMessage = `'${granolaFolderPath}'`;
    }

    new Notice(
      `Granola Sync: Complete. ${syncedCount} notes synced to ${locationMessage}.`,
      7000
    );

    const statusBarItemEl = this.app.workspace.containerEl.querySelector(
      ".status-bar-item .status-bar-item-segment"
    );
    if (statusBarItemEl)
      statusBarItemEl.setText(
        `Granola Sync: Last synced ${new Date(
          this.settings.latestSyncTime
        ).toLocaleString()}`
      );
  }

  async syncGranolaTranscripts() {
    new Notice("Granola Sync: Starting transcript sync...", 5000);

    // Check credentials
    const accessToken = await this.checkCredentials();
    if (!accessToken) return;

    // Fetch documents
    const documents = await this.fetchDocuments(accessToken);
    if (!documents) return;

    // Check folder configuration
    if (!this.settings.granolaFolder) {
      new Notice(
        "Granola Sync Error: Granola folder is not configured.",
        10000
      );
      return;
    }

    const granolaFolderPath = normalizePath(this.settings.granolaFolder);

    // Create folder if needed
    if (!(await this.ensureFolderExists(granolaFolderPath))) return;

    let syncedCount = 0;
    for (const doc of documents) {
      const docId = doc.id;
      const title = doc.title || "Untitled Granola Note";
      try {
        const transcriptResp = await requestUrl({
          url: "https://api.granola.ai/v1/get-document-transcript",
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "*/*",
            "User-Agent": "GranolaObsidianPlugin/0.1.7",
            "X-Client-Version": "ObsidianPlugin-0.1.7",
          },
          body: JSON.stringify({ document_id: docId }),
          throw: true,
        });
        const transcriptData = transcriptResp.json as Array<{
          document_id: string;
          start_timestamp: string;
          text: string;
          source: string;
          id: string;
          is_final: boolean;
          end_timestamp: string;
        }>;
        if (!Array.isArray(transcriptData) || transcriptData.length === 0) {
          continue;
        }

        // Use the extracted formatting function
        const transcriptMd = this.formatTranscriptBySpeaker(
          transcriptData,
          title
        );

        const filename = this.sanitizeFilename(title) + "-transcript.md";
        const filePath = normalizePath(`${granolaFolderPath}/${filename}`);
        await this.app.vault.adapter.write(filePath, transcriptMd);
        syncedCount++;
      } catch (e) {
        new Notice(
          `Error fetching transcript for document: ${title}. Check console.`,
          7000
        );
        console.error(`Transcript fetch error for doc ${docId}:`, e);
      }
    }
    new Notice(
      `Granola Sync: Complete. ${syncedCount} transcripts synced to '${granolaFolderPath}'.`,
      7000
    );
  }
}
