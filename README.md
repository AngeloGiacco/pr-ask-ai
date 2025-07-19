# GitHub PR Diff for LLM Chrome Extension

This Chrome extension adds a "LLM Diff" button to GitHub pull request pages, allowing you to quickly copy the PR diff in a format optimized for Large Language Models.

## Features

- 🔍 Automatically detects GitHub PR pages
- 📋 One-click copy of formatted diff to clipboard
- 🎨 Seamlessly integrates with GitHub's UI
- 🌙 Supports both light and dark themes
- ⚡ Works on both `/pull/123` and `/pull/123/files` URLs

## Installation

### Option 1: Load as Unpacked Extension (Recommended for Development)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the folder containing the extension files
5. The extension should now be active on GitHub PR pages

### Option 2: Manual Installation

1. Download all the files (`manifest.json`, `content.js`, `styles.css`)
2. Create a folder for the extension
3. Add some basic icons (16x16, 48x48, 128x128 PNG files named `icon16.png`, `icon48.png`, `icon128.png`)
4. Follow steps 2-5 from Option 1

## Usage

1. Navigate to any GitHub pull request page
2. Look for the "LLM Diff" button in the top right area of the page (near Edit/Code buttons)
3. Click the button to copy the formatted diff to your clipboard
4. Paste the diff into your LLM conversation

## Output Format

The extension formats the diff like this:

```
PR Diff: [PR Title] (#123)

[filename1.py]
+ added line content
- removed line content
  unchanged line content

[filename2.js]
+ another added line
- another removed line

```

## Technical Details

- **Permissions**: Only requires `activeTab` and `clipboardWrite`
- **Content Script**: Runs only on GitHub PR pages
- **Manifest Version**: 3 (latest Chrome extension standard)

## Troubleshooting

- **Button not appearing**: Make sure you're on a GitHub PR page and refresh the page
- **No diff copied**: Ensure you're on the "Files changed" tab or that the PR has file changes
- **Styling issues**: The extension matches GitHub's current design system but may need updates if GitHub changes their UI

## Development

To modify the extension:

1. Edit the relevant files (`content.js` for functionality, `styles.css` for appearance)
2. Go to `chrome://extensions/` and click the refresh icon for this extension
3. Refresh the GitHub page to see changes

## Contributing

Feel free to submit issues and enhancement requests!