# Obsidian Granola Sync Plugin

This plugin allows you to synchronize your notes from Granola (https://granola.ai) directly into your Obsidian vault. It fetches documents from Granola, converts them from ProseMirror JSON format to Markdown, and saves them as `.md` files.

This project uses TypeScript to provide type checking and documentation.
The repo depends on the latest plugin API (obsidian.d.ts) in TypeScript Definition format, which contains TSDoc comments describing what it does.

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

## Developing

### First time developing plugins?

- Make a copy of this repo as a template with the "Use this template" button (login to GitHub if you don't see it).
- Clone your repo to a local development folder. For convenience, you can place this folder in your `.obsidian/plugins/your-plugin-name` folder.
- Install NodeJS, then run `npm i` in the command line under your repo folder.
- Run `npm run dev` to compile your plugin from `main.ts` to `main.js`.
- Make changes to `main.ts` (or create new `.ts` files). Those changes should be automatically compiled into `main.js`.
- Reload Obsidian to load the new version of your plugin.
- Enable plugin in settings window.
- For updates to the Obsidian API run `npm update` in the command line under your repo folder.

### Releasing new releases

- Update your `manifest.json` with your new version number, such as `1.0.1`, and the minimum Obsidian version required for your latest release.
- Update your `versions.json` file with `"new-plugin-version": "minimum-obsidian-version"` so older versions of Obsidian can download an older version of your plugin that's compatible.
- Create new GitHub release using your new version number as the "Tag version". Use the exact version number, don't include a prefix `v`. See here for an example: https://github.com/obsidianmd/obsidian-sample-plugin/releases
- Upload the files `manifest.json`, `main.js`, `styles.css` as binary attachments. Note: The manifest.json file must be in two places, first the root path of your repository and also in the release.
- Publish the release.

> You can simplify the version bump process by running `npm version patch`, `npm version minor` or `npm version major` after updating `minAppVersion` manually in `manifest.json`.
> The command will bump version in `manifest.json` and `package.json`, and add the entry for the new version to `versions.json`

### Adding your plugin to the community plugin list

- Check the [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
- Publish an initial version.
- Make sure you have a `README.md` file in the root of your repo.
- Make a pull request at https://github.com/obsidianmd/obsidian-releases to add your plugin.

### Manually installing the plugin

- Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.

### Improve code quality with eslint (optional)
- [ESLint](https://eslint.org/) is a tool that analyzes your code to quickly find problems. You can run ESLint against your plugin to find common bugs and ways to improve your code.
- To use eslint with this project, make sure to install eslint from terminal:
  - `npm install -g eslint`
- To use eslint to analyze this project use this command:
  - `eslint main.ts`
  - eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder:
  - `eslint .\src\`

### Funding URL

You can include funding URLs where people who use your plugin can financially support it.

The simple way is to set the `fundingUrl` field to your link in your `manifest.json` file:

```json
{
    "fundingUrl": "https://buymeacoffee.com"
}
```

If you have multiple URLs, you can also do:

```json
{
    "fundingUrl": {
        "Buy Me a Coffee": "https://buymeacoffee.com",
        "GitHub Sponsor": "https://github.com/sponsors",
        "Patreon": "https://www.patreon.com/"
    }
}
```

## API Documentation

See https://github.com/obsidianmd/obsidian-api
