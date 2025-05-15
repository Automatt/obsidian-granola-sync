import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface GranolaSyncSettings {
	tokenPath: string;
	granolaFolder: string;
	latestSyncTime: number;
	isSyncEnabled: boolean;
	syncInterval: number;

}

const DEFAULT_SETTINGS: GranolaSyncSettings = {
	tokenPath: 'Library/Application Support/Granola/supabase.json',
	granolaFolder: 'Granola',
	latestSyncTime: 0,
	isSyncEnabled: false,
	syncInterval: 30 * 60 // every 30 minutes
}

export default class GranolaSync extends Plugin {
	settings: GranolaSyncSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
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

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
		containerEl.createEl('h3', {text: 'Granola Sync'});

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
				.setPlaceholder('Enter the interval to sync notes')
				.setValue(this.plugin.settings.syncInterval.toString())
				.onChange(async (value) => {
					this.plugin.settings.syncInterval = parseInt(value);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sync Enabled')
			.setDesc('Enable periodic sync of notes from Granola')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.isSyncEnabled)
				.onChange(async (value) => {
					this.plugin.settings.isSyncEnabled = value;
					await this.plugin.saveSettings();
				}));
	}
}
