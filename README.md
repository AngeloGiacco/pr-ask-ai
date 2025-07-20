# GitHub PR Diff for LLM Chrome Extension

This Chrome extension adds a "LLM Diff" button to GitHub pull request pages, allowing you to quickly copy the PR diff in a format optimized for Large Language Models.

## Features

- 📋 One-click copy of PR diff to clipboard
- ⚡ Works on any GitHub PR page
- 🔒 Works with private repositories
- 🎨 Clean integration with GitHub's UI

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
2. Click the "LLM Diff" button (appears near Edit/Code buttons)
3. Paste the diff into your LLM conversation

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

## Development

To modify the extension:

1. Edit the relevant files (`content.js` for functionality, `styles.css` for appearance)
2. Go to `chrome://extensions/` and click the refresh icon for this extension
3. Refresh the GitHub page to see changes

## Contributing

Feel free to submit issues and enhancement requests!