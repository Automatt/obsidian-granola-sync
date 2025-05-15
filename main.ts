import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl, moment, normalizePath } from 'obsidian';
import {
	createDailyNote,
	getDailyNote,
	getAllDailyNotes,
  } from "obsidian-daily-notes-interface";
  
// Remember to rename these classes and interfaces!

interface GranolaSyncSettings {
	tokenPath: string;
	granolaFolder: string;
	latestSyncTime: number;
	isSyncEnabled: boolean;
	syncInterval: number;
	syncToDailyNotes: boolean;
	dailyNoteSectionHeading: string;
}

const DEFAULT_SETTINGS: GranolaSyncSettings = {
	tokenPath: 'configs/supabase.json',
	granolaFolder: 'Granola',
	latestSyncTime: 0,
	isSyncEnabled: false,
	syncInterval: 30 * 60, // every 30 minutes
	syncToDailyNotes: false,
	dailyNoteSectionHeading: '## Synced Granola Notes'
}

// Helper interfaces for ProseMirror and API responses
interface ProseMirrorNode {
	type: string;
	content?: ProseMirrorNode[];
	text?: string;
	attrs?: { [key: string]: any };
}

interface ProseMirrorDoc {
	type: 'doc';
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

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sync Granola Notes', async (evt: MouseEvent) => {
			new Notice('Granola Sync: Starting manual sync...');
			await this.syncGranolaNotes();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Granola Sync Idle'); // Updated status bar text

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'sync-granola-notes',
			name: 'Sync Notes from Granola', // Updated command name
			callback: async () => {
				new Notice('Granola Sync: Starting manual sync...');
				statusBarItemEl.setText('Granola Sync: Syncing...');
				await this.syncGranolaNotes();
				statusBarItemEl.setText(`Granola Sync: Last synced ${new Date(this.settings.latestSyncTime).toLocaleString()}`);
			}
		});

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new GranolaSyncSettingTab(this.app, this));

		// Setup periodic sync based on settings
		this.setupPeriodicSync();

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// Example: this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
		// We handle our interval manually with setupPeriodicSync and clearPeriodicSync
	}

	onunload() {
		this.clearPeriodicSync();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Re-evaluate periodic sync when settings change (e.g., interval or enabled status)
		this.setupPeriodicSync();
	}

	setupPeriodicSync() {
		this.clearPeriodicSync(); // Clear any existing interval first
		if (this.settings.isSyncEnabled && this.settings.syncInterval > 0) {
			console.log(`Granola Sync: Setting up periodic sync every ${this.settings.syncInterval} seconds.`);
			this.syncIntervalId = window.setInterval(async () => {
				const statusBarItemEl = this.app.workspace.containerEl.querySelector('.status-bar-item .status-bar-item-segment');
				if (statusBarItemEl) statusBarItemEl.setText('Granola Sync: Auto-syncing...');
				console.log("Granola Sync: Performing periodic sync.");
				await this.syncGranolaNotes();
				if (statusBarItemEl) statusBarItemEl.setText(`Granola Sync: Last synced ${new Date(this.settings.latestSyncTime).toLocaleString()}`);
			}, this.settings.syncInterval * 1000);
			this.registerInterval(this.syncIntervalId); // Register with Obsidian to auto-clear on disable
		} else {
			console.log("Granola Sync: Periodic sync is disabled or interval is zero.");
		}
	}

	clearPeriodicSync() {
		if (this.syncIntervalId !== null) {
			window.clearInterval(this.syncIntervalId);
			this.syncIntervalId = null;
			console.log("Granola Sync: Cleared periodic sync interval.");
		}
	}

	// Helper to escape strings for use in regex
	private escapeRegExp(string: string): string {
		return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
	}

	private sanitizeFilename(title: string): string {
		const invalidChars = /[<>:"/\\|?*]/g;
		let filename = title.replace(invalidChars, '');
		filename = filename.replace(/\s+/g, '_'); // Replace one or more spaces with a single underscore
		// Truncate filename if too long (e.g., 200 chars, common limit)
		const maxLength = 200;
		if (filename.length > maxLength) {
			filename = filename.substring(0, maxLength);
		}
		return filename;
	}

	private convertProsemirrorToMarkdown(doc: ProseMirrorDoc | null | undefined): string {
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
					// Ensure paragraphs are separated by exactly one blank line from previous content
					// unless they are empty.
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
		
		// Post-processing: Remove excessive newlines, ensure at most two newlines between blocks
		return markdownOutput.join('').replace(/\n{3,}/g, '\n\n').trim();
	}

	async syncGranolaNotes() {
		console.log("Granola Sync: Starting sync process");
		new Notice("Granola Sync: Starting sync...", 5000);

		// 1. Load Credentials
		let accessToken: string | null = null;
		try {
			if (!this.settings.tokenPath) {
				new Notice("Granola Sync Error: Token path is not configured in settings.", 10000);
				console.error("Granola Sync: Token path is not configured.");
				return;
			}
			
			// Check if the token path is an absolute path (likely problematic)
			if (this.settings.tokenPath.startsWith('/') || this.settings.tokenPath.match(/^[A-Za-z]:\\/)) {
					new Notice(
						"Granola Sync Warning: Token path appears to be an absolute path. " +
						"Please ensure it's a path relative to your vault root, e.g., 'configs/supabase.json'. " +
						"Plugins typically cannot access arbitrary file system locations.", 15000);
					console.warn("Granola Sync: Token path is absolute. This might fail due to sandboxing.");
			}
			
			if (!await this.app.vault.adapter.exists(normalizePath(this.settings.tokenPath))) {
				new Notice(`Granola Sync Error: Credentials file not found at '${this.settings.tokenPath}'. Please check the path in settings.`, 10000);
				console.error(`Granola Sync: Credentials file not found at: ${this.settings.tokenPath}`);
				return;
			}

			const tokenFileContent = await this.app.vault.adapter.read(normalizePath(this.settings.tokenPath));
			const tokenData = JSON.parse(tokenFileContent);
			const cognitoTokens = JSON.parse(tokenData.cognito_tokens); // Assuming cognito_tokens is a stringified JSON
			accessToken = cognitoTokens.access_token;

			if (!accessToken) {
				new Notice("Granola Sync Error: No access token found in credentials file.", 10000);
				console.error("Granola Sync: No access token found.");
				return;
			}
			console.log("Granola Sync: Successfully loaded credentials.");

		} catch (error) {
			new Notice("Granola Sync Error: Failed to load credentials. Check console for details.", 10000);
			console.error("Granola Sync: Error loading credentials file:", error);
			return;
		}

		// 2. Fetch Documents
		let documents: GranolaDoc[] = [];
		try {
			const response = await requestUrl({
				url: "https://api.granola.ai/v2/get-documents",
				method: "POST",
				headers: {
					"Authorization": `Bearer ${accessToken}`,
					"Content-Type": "application/json",
					"Accept": "*/*",
					"User-Agent": "GranolaObsidianPlugin/0.1.0", // Custom User-Agent
        			"X-Client-Version": "ObsidianPlugin-0.1.0" // Custom Client Version
				},
				body: JSON.stringify({
					"limit": 100, // Consider making this configurable or implement pagination
					"offset": 0,
					"include_last_viewed_panel": true
				}),
				throw: true // Throws error for non-2xx status codes
			});

			const apiResponse = response.json as GranolaApiResponse;
			if (!apiResponse || !apiResponse.docs) {
				new Notice("Granola Sync Error: Invalid API response format.", 10000);
				console.error("Granola Sync: API response format is unexpected - 'docs' key not found or empty response", apiResponse);
				return;
			}
			documents = apiResponse.docs;
			console.log(`Granola Sync: Successfully fetched ${documents.length} documents.`);

		} catch (error) {
			new Notice("Granola Sync Error: Failed to fetch documents from Granola API. Check console.", 10000);
			console.error("Granola Sync: Error fetching documents:", error);
			return;
		}

		// 3. Process and Save Documents
		if (!this.settings.granolaFolder && !this.settings.syncToDailyNotes) { // Adjusted condition
			new Notice("Granola Sync Error: Granola folder is not configured and not syncing to daily notes.", 10000);
			console.error("Granola Sync: Granola folder name is not configured and not syncing to daily notes.");
			return;
		}
		
		const granolaFolderPath = normalizePath(this.settings.granolaFolder);

		if (!this.settings.syncToDailyNotes) { // Create folder only if not syncing to daily notes
			try {
				if (!await this.app.vault.adapter.exists(granolaFolderPath)) {
					await this.app.vault.createFolder(granolaFolderPath);
					console.log(`Granola Sync: Created folder '${granolaFolderPath}'.`);
				}
			} catch (error) {
				new Notice(`Granola Sync Error: Could not create folder '${granolaFolderPath}'. Check console.`, 10000);
				console.error(`Granola Sync: Error creating folder '${granolaFolderPath}':`, error);
				return;
			}
		}

		let syncedCount = 0;

		if (this.settings.syncToDailyNotes) {
			const dailyNotesMap: Map<string, { title: string; docId: string; createdAt?: string; updatedAt?: string; markdown: string }[]> = new Map();

			for (const doc of documents) {
				const title = doc.title || "Untitled Granola Note";
				const docId = doc.id || "unknown_id";
				const contentToParse = doc.last_viewed_panel?.content;

				if (!contentToParse || contentToParse.type !== "doc") {
					console.warn(`Granola Sync: Skipping document '${title}' (ID: ${docId}) for daily note - no suitable content.`);
					continue;
				}
				const markdownContent = this.convertProsemirrorToMarkdown(contentToParse);

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
					markdown: markdownContent
				});
			}

			const sectionHeading = this.settings.dailyNoteSectionHeading;
			const escapedSectionHeading = this.escapeRegExp(sectionHeading);
			
			// Determine the heading level to correctly find the end of the section
			const headingMatch = sectionHeading.match(/^#+/);
			const headingLevel = headingMatch ? headingMatch[0].length : 0;
			
			// Regex to find the section: from the heading to the next heading of same or lower level, or EOF
			// It captures the content *after* the heading in group 1.
			// The (?=\n^#{1,${headingLevel}} |\n*$) part is a positive lookahead.
			// It asserts that the match is followed by either a newline and another heading 
			// (of level 1 up to current headingLevel) or by zero or more newlines at the end of the string.
			const sectionRegex = new RegExp(`(^${escapedSectionHeading}\n)([\s\S]*?)(?=\n^#{1,${headingLevel}}\s[^#]|\n*$)`, "m");

			for (const [dateKey, notesForDay] of dailyNotesMap) {
				const noteMoment = moment(dateKey, "YYYY-MM-DD");
				let dailyNoteFile = getDailyNote(noteMoment, getAllDailyNotes());

				if (!dailyNoteFile) {
					dailyNoteFile = await createDailyNote(noteMoment);
					console.log(`Granola Sync: Created daily note ${dailyNoteFile.path}.`);
				}

				let fullSectionContent = sectionHeading + "\n";
				for (const note of notesForDay) {
					fullSectionContent += `\n### ${note.title}\n`;
					fullSectionContent += `**Granola ID:** ${note.docId}\n`;
					if (note.createdAt) fullSectionContent += `**Created:** ${note.createdAt}\n`;
					if (note.updatedAt) fullSectionContent += `**Updated:** ${note.updatedAt}\n`;
					fullSectionContent += `\n${note.markdown}\n`;
				}

				let currentFileContent = await this.app.vault.read(dailyNoteFile);
				const match = currentFileContent.match(sectionRegex);

				if (match) {
					// Section exists, replace it. We replace the whole match (group 0)
					currentFileContent = currentFileContent.replace(sectionRegex, fullSectionContent.trim() + "\n");
					console.log(`Granola Sync: Updated section '${sectionHeading}' in daily note: ${dailyNoteFile.path}`);
				} else {
					// Section does not exist, append it. Add a newline before if content exists.
					const separator = currentFileContent.trim().length > 0 ? "\n\n" : "";
					currentFileContent = currentFileContent.trim() + separator + fullSectionContent.trim() + "\n";
					console.log(`Granola Sync: Appended section '${sectionHeading}' to daily note: ${dailyNoteFile.path}`);
				}
				await this.app.vault.modify(dailyNoteFile, currentFileContent);
				syncedCount += notesForDay.length;
			}

		} else {
			// Original logic for syncing to individual files
			for (const doc of documents) {
				const title = doc.title || "Untitled Granola Note";
				const docId = doc.id || "unknown_id";
				console.log(`Granola Sync: Processing document for individual file: ${title} (ID: ${docId})`);

				const contentToParse = doc.last_viewed_panel?.content;
				if (!contentToParse || contentToParse.type !== "doc") {
					console.warn(`Granola Sync: Skipping document '${title}' (ID: ${docId}) - no suitable content found.`);
					continue;
				}

				try {
					const markdownContent = this.convertProsemirrorToMarkdown(contentToParse);
					const escapedTitleForYaml = title.replace(/"/g, '\\"');

					const frontmatterLines = [
						"---",
						`granola_id: ${docId}`,
						`title: "${escapedTitleForYaml}"`
					];
					if (doc.created_at) frontmatterLines.push(`created_at: ${doc.created_at}`);
					if (doc.updated_at) frontmatterLines.push(`updated_at: ${doc.updated_at}`);
					frontmatterLines.push("---", "");

					const finalMarkdown = frontmatterLines.join('\n') + markdownContent;
					const filename = this.sanitizeFilename(title) + ".md";
					const filePath = normalizePath(`${granolaFolderPath}/${filename}`);

					await this.app.vault.adapter.write(filePath, finalMarkdown);
					console.log(`Granola Sync: Successfully saved: ${filePath}`);
					syncedCount++;
				} catch (e) {
					console.error(`Granola Sync: Error processing document '${title}' (ID: ${docId}) for individual file:`, e);
					new Notice(`Error processing document: ${title}. Check console.`, 7000);
				}
			}
		}

		this.settings.latestSyncTime = Date.now();
		await this.saveSettings(); // Save settings to persist latestSyncTime

		new Notice(`Granola Sync: Complete. ${syncedCount} notes synced to '${granolaFolderPath}'.`, 7000);
		console.log(`Granola Sync: Sync complete. ${syncedCount} notes saved to '${granolaFolderPath}'.`);
		
		const statusBarItemEl = this.app.workspace.containerEl.querySelector('.status-bar-item .status-bar-item-segment');
		if (statusBarItemEl) statusBarItemEl.setText(`Granola Sync: Last synced ${new Date(this.settings.latestSyncTime).toLocaleString()}`);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class GranolaSyncSettingTab extends PluginSettingTab {
	plugin: GranolaSync;

	constructor(app: App, plugin: GranolaSync) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h3', {text: 'Granola Sync Settings'}); // Updated title

		new Setting(containerEl)
			.setName('Token Path')
			.setDesc('Path to the Granola token file.  This needs to be a path relative to your vault root, e.g., "configs/supabase.json".  Copy this file from the Granola directory, for example from ~/Library/Application Support/Granola/supabase.json')
			.addText(text => text
				.setPlaceholder('Enter the path to the Granola token file')
				.setValue(this.plugin.settings.tokenPath)
				.onChange(async (value) => {
					this.plugin.settings.tokenPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Granola Folder')
			.setDesc('Folder name to write notes to')
			.addText(text => text
				.setPlaceholder('Name of the folder to write notes to')
				.setValue(this.plugin.settings.granolaFolder)
				.onChange(async (value) => {
					this.plugin.settings.granolaFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sync Interval')
			.setDesc('Interval to sync notes')
			.addText(text => text
				.setPlaceholder('Enter the interval in seconds') // Clarified placeholder
				.setValue(this.plugin.settings.syncInterval.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue >= 0) { // Basic validation
						this.plugin.settings.syncInterval = numValue;
						await this.plugin.saveSettings();
					} else {
						new Notice("Please enter a valid number for sync interval.");
					}
				}));

		new Setting(containerEl)
			.setName('Sync Enabled')
			.setDesc('Enable periodic sync of notes from Granola')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.isSyncEnabled)
				.onChange(async (value) => {
					this.plugin.settings.isSyncEnabled = value;
					await this.plugin.saveSettings();
					// this.plugin.setupPeriodicSync(); // Settings save already calls this
				}));

		new Setting(containerEl)
			.setName('Sync to Daily Notes')
			.setDesc('Append synced notes to the daily note corresponding to their creation date, instead of creating separate files.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.syncToDailyNotes)
				.onChange(async (value) => {
					this.plugin.settings.syncToDailyNotes = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Daily Note Section Heading')
			.setDesc('The heading to use for the section where Granola notes will be added in your daily notes. Example: "## Granola Sync"')
			.addText(text => text
				.setPlaceholder('Enter section heading')
				.setValue(this.plugin.settings.dailyNoteSectionHeading)
				.onChange(async (value) => {
					this.plugin.settings.dailyNoteSectionHeading = value;
					await this.plugin.saveSettings();
				}));
	}
}
