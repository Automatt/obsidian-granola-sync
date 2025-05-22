import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type GranolaSync from './main';

export interface GranolaSyncSettings {
	tokenPath: string;
	granolaFolder: string;
	latestSyncTime: number;
	isSyncEnabled: boolean;
	syncInterval: number;
	syncToDailyNotes: boolean;
	dailyNoteSectionHeading: string;
}

export const DEFAULT_SETTINGS: GranolaSyncSettings = {
	tokenPath: 'configs/supabase.json',
	granolaFolder: 'Granola',
	latestSyncTime: 0,
	isSyncEnabled: false,
	syncInterval: 30 * 60, // every 30 minutes
	syncToDailyNotes: true,
	dailyNoteSectionHeading: '## Granola Notes'
};

export class GranolaSyncSettingTab extends PluginSettingTab {
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
			.setName('Path to Granola Access Token File')
			.setDesc('Path to the Granola token file relative to your vault root (e.g., "configs/supabase.json"). This file contains your authentication token and needs to be copied from your Granola application directory. On macOS, it\'s typically located at ~/Library/Application Support/Granola/supabase.json. The token expires periodically, so you may need to update this file when authentication fails.')
			.addText(text => text
				.setPlaceholder('Enter the path to the Granola token file')
				.setValue(this.plugin.settings.tokenPath)
				.onChange(async (value) => {
					this.plugin.settings.tokenPath = value;
					await this.plugin.saveSettings();
				}));


		new Setting(containerEl)
			.setName('Periodic Sync Enabled')
			.setDesc('Enable periodic sync of notes from Granola, so you don\'t have to manually sync.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.isSyncEnabled)
				.onChange(async (value) => {
					this.plugin.settings.isSyncEnabled = value;
					await this.plugin.saveSettings();
					// this.plugin.setupPeriodicSync(); // Settings save already calls this
				}));


            new Setting(containerEl)
            .setName('Sync Interval')
            .setDesc('Interval to sync notes, in seconds.  Default is 30 minutes.')
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
			.setName('Put Granola Meetings into Daily Notes')
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
        new Setting(containerEl)
        .setName('Granola Folder')
        .setDesc('Folder name to write notes to, if you are not syncing to daily notes.')
        .addText(text => text
            .setPlaceholder('Name of the folder to write notes to')
            .setValue(this.plugin.settings.granolaFolder)
            .onChange(async (value) => {
                this.plugin.settings.granolaFolder = value;
                await this.plugin.saveSettings();
            }));
    
	}
} 