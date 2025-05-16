# Obsidian Granola Sync Plugin

This plugin allows you to synchronize your notes from Granola (https://granola.ai) directly into your Obsidian vault. It fetches documents from Granola, converts them from ProseMirror JSON format to Markdown, and saves them as `.md` files.

## Features

- **Sync Granola Notes**: Fetch your latest notes from Granola.
- **Markdown Conversion**: Automatically converts notes from Granola's ProseMirror format to Markdown.
- **Frontmatter Metadata**: Adds frontmatter to each note, including Granola document ID, title, creation date, and update date.
- **Configurable Output**: Specify the folder within your vault where Granola notes should be saved.
- **Manual Sync**: Trigger a sync anytime using a ribbon icon or a command palette command.
- **Periodic Sync**: Optionally, configure the plugin to automatically sync notes at a defined interval.
- **Customizable Settings**: Manage your Granola token path, output folder, sync interval, and enable/disable periodic sync through the plugin settings tab.
- **Sync to Daily Notes**: Optionally sync your Granola notes directly into your daily notes, organized under a configurable section heading.

## Setup

1.  **Get Your Granola Token**:
    *   The plugin needs your Granola `supabase.json` file to authenticate with the Granola API.
    *   You can typically find this file in the Granola application support directory. For example, on macOS, it's often located at: `~/Library/Application Support/Granola/supabase.json`.
    *   The Granola token expires periodically, so if you want persistent syncing, you might want to either create a symbolic link or set up an automation like a cron job to keep the file up to date.  Plug ins can't typically access files outside of the vault, so this step is necessary until Granola provides better API access.
2.  **Place Token in Vault**:
    *   Copy the `supabase.json` file into your Obsidian vault.
    *   It's recommended to place it in a dedicated folder, for example, a folder named `configs` or `_private` at the root of your vault.
3.  **Configure Plugin Settings**:
    *   Open Obsidian settings (usually by clicking the gear icon).
    *   Go to "Community Plugins" and find "Granola Sync".
    *   In the plugin settings:
        *   **Path to Granola Access Token File**: Set this to the path of your `supabase.json` file *relative to your vault root*. For example, if you placed it in `VaultFolder/configs/supabase.json`, you would enter `configs/supabase.json`.
        *   **Put Granola Notes into Daily Notes**: By default, your Granola notes will be added to a section in each Daily Note corresponding to the date on the Granola note.  In subsequent Syncs this section will be replaced with content from Granola, but other parts of the daily notes won't be touched.
        *   **Daily Note Section Heading**: Specify the name of the section heading used.  After you've synced your notes, you shouldn't change this.  The plugin uses this to find and replace the note content so there are aren't duplicated notes on subsequent syncs.
        *   **Granola Folder**: If you're not putting content into Daily Notes, the plugin will import your notes into a specific folder, one file per Granola note.  Specify the name of the folder where your synced Granola notes should be saved (e.g., `Granola Notes`). This folder will be created if it doesn't exist.
        *   Adjust other settings like `Sync Interval` and `Periodic Sync Enabled` as needed.

## How to Use

-   **Manual Sync**:
    *   Click the "Sync Granola Notes" ribbon icon (it might look like dice, this can be changed).
    *   Alternatively, open the command palette (usually `Cmd/Ctrl + P`) and search for "Sync Notes from Granola", then execute the command.
-   **Automatic Sync**:
    *   If "Periodic Sync Enabled" is turned on in the settings, the plugin will automatically fetch notes at the specified "Sync Interval".

## Gratitude 🙏

This plugin was inspired by this awesome [blog post](https://josephthacker.com/hacking/2025/05/08/reverse-engineering-granola-notes.html) by [Joseph Thacker](https://josephthacker.com). Thank you!


## Contributing

To make changes to this plugin, first ensure you have the dependencies installed.

```
yarn install
```

### Development

To start building the plugin with what mode enabled run the following command:

```
yarn dev
```

_Note: If you haven't already installed the hot-reload-plugin you'll be prompted to. You need to enable that plugin in your obsidian vault before hot-reloading will start. You might need to refresh your plugin list for it to show up._

### Releasing

To start a release build run the following command:

```
yarn build
```
