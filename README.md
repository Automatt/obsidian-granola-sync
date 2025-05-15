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

## Setup

1.  **Get Your Granola Token**:
    *   The plugin needs your Granola `supabase.json` file to authenticate with the Granola API.
    *   You can typically find this file in the Granola application support directory. For example, on macOS, it's often located at: `~/Library/Application Support/Granola/supabase.json`.
2.  **Place Token in Vault**:
    *   Copy the `supabase.json` file into your Obsidian vault.
    *   It's recommended to place it in a dedicated folder, for example, a folder named `configs` or `_private` at the root of your vault.
3.  **Configure Plugin Settings**:
    *   Open Obsidian settings (usually by clicking the gear icon).
    *   Go to "Community Plugins" and find "Granola Sync".
    *   In the plugin settings:
        *   **Token Path**: Set this to the path of your `supabase.json` file *relative to your vault root*. For example, if you placed it in `VaultFolder/configs/supabase.json`, you would enter `configs/supabase.json`.
        *   **Granola Folder**: Specify the name of the folder where your synced Granola notes should be saved (e.g., `Granola Notes`). This folder will be created if it doesn't exist.
        *   Adjust other settings like `Sync Interval` and `Sync Enabled` as needed.

## How to Use

-   **Manual Sync**:
    *   Click the "Sync Granola Notes" ribbon icon (it might look like dice, this can be changed).
    *   Alternatively, open the command palette (usually `Cmd/Ctrl + P`) and search for "Sync Notes from Granola", then execute the command.
-   **Automatic Sync**:
    *   If "Sync Enabled" is turned on in the settings, the plugin will automatically fetch notes at the specified "Sync Interval".

## Settings

The plugin provides the following settings, accessible via the Obsidian settings panel under "Granola Sync":

-   **Token Path**:
    *   Description: Path to the Granola `supabase.json` token file.
    *   Important: This needs to be a path relative to your vault root, e.g., `"configs/supabase.json"`. Copy this file from your Granola application directory (e.g., `~/Library/Application Support/Granola/supabase.json` on macOS).
-   **Granola Folder**:
    *   Description: Folder name within your vault where synced Granola notes will be written.
    *   Example: `Granola Imported Notes`
-   **Sync Interval**:
    *   Description: Interval in seconds for periodic syncing of notes. Set to 0 to disable if "Sync Enabled" is on but you only want manual syncs, or rely on the toggle.
    *   Example: `1800` (for 30 minutes)
-   **Sync Enabled**:
    *   Description: Enable or disable the periodic automatic sync of notes from Granola.

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
