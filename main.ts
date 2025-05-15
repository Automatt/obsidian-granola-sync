import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, requestUrl, normalizePath } from 'obsidian';

// Remember to rename these classes and interfaces!

interface GranolaSyncSettings {
	tokenPath: string;
	granolaFolder: string;
	latestSyncTime: number;
	isSyncEnabled: boolean;
	syncInterval: number;
}

const DEFAULT_SETTINGS: GranolaSyncSettings = {
	tokenPath: 'configs/supabase.json',
	granolaFolder: 'Granola',
	latestSyncTime: 0,
	isSyncEnabled: false,
	syncInterval: 30 * 60 // every 30 minutes
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
		if (!this.settings.granolaFolder) {
			new Notice("Granola Sync Error: Granola folder is not configured in settings.", 10000);
			console.error("Granola Sync: Granola folder name is not configured.");
			return;
		}
		
		const granolaFolderPath = normalizePath(this.settings.granolaFolder);
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

		let syncedCount = 0;
		for (const doc of documents) {
			const title = doc.title || "Untitled Granola Note";
			const docId = doc.id || "unknown_id";
			console.log(`Granola Sync: Processing document: ${title} (ID: ${docId})`);

			const contentToParse = doc.last_viewed_panel?.content;
			if (!contentToParse || contentToParse.type !== "doc") {
				console.warn(`Granola Sync: Skipping document '${title}' (ID: ${docId}) - no suitable content found.`);
				continue;
			}

			try {
				const markdownContent = this.convertProsemirrorToMarkdown(contentToParse);
				
				let escapedTitleForYaml = title.replace(/"/g, '\\"');
				
				const frontmatter = 
`---
granola_id: ${docId}
title: "${escapedTitleForYaml}"
${doc.created_at ? `created_at: ${doc.created_at}` : ''}
${doc.updated_at ? `updated_at: ${doc.updated_at}` : ''}
---

`;
				// Ensure created_at and updated_at lines are only added if they exist, and correctly formatted
				let frontmatterLines = [
					"---",
					`granola_id: ${docId}`,
					`title: "${escapedTitleForYaml}"`
				];
				if (doc.created_at) frontmatterLines.push(`created_at: ${doc.created_at}`);
				if (doc.updated_at) frontmatterLines.push(`updated_at: ${doc.updated_at}`);
				frontmatterLines.push("---", ""); // Extra newline after frontmatter block

				const finalMarkdown = frontmatterLines.join('\n') + markdownContent;
				const filename = this.sanitizeFilename(title) + ".md";
				const filePath = normalizePath(`${granolaFolderPath}/${filename}`);

				await this.app.vault.adapter.write(filePath, finalMarkdown);
				console.log(`Granola Sync: Successfully saved: ${filePath}`);
				syncedCount++;
			} catch (e) {
				console.error(`Granola Sync: Error processing document '${title}' (ID: ${docId}):`, e);
				new Notice(`Error processing document: ${title}. Check console.`, 7000);
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
			.setDesc('Path to the Granola token file')
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
	}
}
