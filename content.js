// Content script for GitHub PR Diff LLM extension

class GitHubPRDiffExtractor {
    constructor() {
      this.button = null;
      this.isProcessing = false;
      this.pendingExtraction = false;
    }
  
    // Check if we're on a PR page
    isPRPage() {
      const url = window.location.href;
      return /github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/.test(url);
    }
  
    // Create the copy button
    createCopyButton() {
      const button = document.createElement('button');
      button.innerHTML = `
        <svg aria-hidden="true" focusable="false" class="octicon octicon-copy" viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
          <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"></path>
          <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>
        </svg>
        <span class="llm-diff-text">LLM Diff</span>
      `;
      button.className = 'prc-Button-ButtonBase-c50BI llm-diff-button';
      button.setAttribute('data-loading', 'false');
      button.setAttribute('data-size', 'small');
      button.setAttribute('data-variant', 'default');
      button.title = 'Copy PR diff formatted for LLM';
      
      button.addEventListener('click', () => this.handleCopyClick());
      
      return button;
    }
  
    // Find the best insertion point for the button
    findInsertionPoint() {
      // Look for the header actions area (where Edit and Code buttons are)
      const headerActions = document.querySelector('.prc-PageHeader-Actions-ygtmj, .PageHeader-actions');
      if (headerActions) {
        return headerActions;
      }
  
      // Fallback: look for any button container in the header
      const buttonContainer = document.querySelector('.d-flex.flex-items-center.gap-1');
      if (buttonContainer && buttonContainer.querySelector('button')) {
        return buttonContainer;
      }
  
      // Last resort: create our own container
      const header = document.querySelector('.prc-PageHeader-PageHeader-sT1Hp, .PageHeader');
      if (header) {
        const container = document.createElement('div');
        container.className = 'd-flex flex-items-center gap-1';
        header.appendChild(container);
        return container;
      }
  
      return null;
    }
  
    // Insert the button into the page
    insertButton() {
      if (this.button) return; // Already inserted
  
      const insertionPoint = this.findInsertionPoint();
      if (!insertionPoint) {
        console.log('Could not find insertion point for LLM diff button');
        return;
      }
  
      this.button = this.createCopyButton();
      insertionPoint.appendChild(this.button);
      
      // Check if we need to auto-extract after navigation
      if (this.pendingExtraction && this.isOnFilesPage()) {
        setTimeout(() => {
          this.autoExtractAfterNavigation();
        }, 1000); // Wait for page to fully load
      }
    }

    // Auto-extract after navigating to files page
    async autoExtractAfterNavigation() {
      if (!this.pendingExtraction || !this.button) return;
      
      this.isProcessing = true;
      this.button.querySelector('.llm-diff-text').textContent = 'Extracting...';
      this.button.disabled = true;
      
      // Wait a bit more for diff tables to load
      setTimeout(async () => {
        await this.performExtraction();
      }, 500);
    }
  
    // Extract PR title and number
    getPRInfo() {
      const titleElement = document.querySelector('.prc-PageHeader-Title-LKOsd, .js-issue-title');
      const title = titleElement ? titleElement.textContent.trim() : 'Unknown PR';
      
      const url = window.location.href;
      const prNumberMatch = url.match(/\/pull\/(\d+)/);
      const prNumber = prNumberMatch ? prNumberMatch[1] : 'unknown';
      
      // Extract repo info for API calls
      const repoMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull/);
      const owner = repoMatch ? repoMatch[1] : null;
      const repo = repoMatch ? repoMatch[2] : null;
      
      return { title, prNumber, owner, repo };
    }

    // Extract diff data using GitHub API
    async extractDiffDataFromAPI() {
      const prInfo = this.getPRInfo();
      
      if (!prInfo.owner || !prInfo.repo || !prInfo.prNumber) {
        throw new Error('Could not extract repository information from URL');
      }
      
      try {
        // First, get the PR files from GitHub API
        const filesResponse = await fetch(`https://api.github.com/repos/${prInfo.owner}/${prInfo.repo}/pulls/${prInfo.prNumber}/files`);
        
        if (!filesResponse.ok) {
          throw new Error(`GitHub API responded with ${filesResponse.status}: ${filesResponse.statusText}`);
        }
        
        const files = await filesResponse.json();
        
        // Convert API response to our diff format
        const diffData = files.map(file => {
          const changes = [];
          
          // Parse the patch content
          if (file.patch) {
            const lines = file.patch.split('\n');
            let currentLineNumber = 0;
            
            for (const line of lines) {
              if (line.startsWith('@@')) {
                // Parse hunk header to get line numbers
                const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
                if (match) {
                  currentLineNumber = parseInt(match[2]);
                }
                continue;
              }
              
              if (line.startsWith('+')) {
                changes.push({
                  type: 'addition',
                  lineNumber: currentLineNumber.toString(),
                  content: line.substring(1)
                });
                currentLineNumber++;
              } else if (line.startsWith('-')) {
                changes.push({
                  type: 'deletion',
                  lineNumber: '',
                  content: line.substring(1)
                });
              } else if (line.startsWith(' ')) {
                changes.push({
                  type: 'context',
                  lineNumber: currentLineNumber.toString(),
                  content: line.substring(1)
                });
                currentLineNumber++;
              }
            }
          }
          
          return {
            fileName: file.filename,
            changes: changes
          };
        });
        
        return diffData.filter(file => file.changes.length > 0);
        
      } catch (error) {
        console.error('Failed to fetch diff from GitHub API:', error);
        throw error;
      }
    }
  
    // Extract diff data from the page
    extractDiffData() {
      const diffData = [];
      
      // Look for file diff containers using updated selectors for new GitHub structure
      const diffContainers = document.querySelectorAll('table[aria-label*="Diff for:"], table[data-diff-anchor], .file-diff, .js-file-diff-split, [data-diff-anchor]');
      
      diffContainers.forEach(container => {
        let fileName = '';
        
        // Extract file name from table aria-label (new GitHub structure)
        if (container.tagName === 'TABLE' && container.getAttribute('aria-label')) {
          const ariaLabel = container.getAttribute('aria-label');
          const match = ariaLabel.match(/Diff for: (.+)/);
          if (match) {
            fileName = match[1];
          }
        }
        
        // Fallback to older selectors if aria-label method didn't work
        if (!fileName) {
          const fileHeader = container.querySelector(
            '.DiffFileHeader-module__file-name--mY1O5, .file-header, [data-path], .file-info a'
          );
          if (fileHeader) {
            fileName = fileHeader.getAttribute('data-path') || fileHeader.textContent.trim();
          }
        }
        
        if (!fileName) return;
        
        const diffLines = [];
        
        // Extract diff lines using updated selectors for new GitHub structure
        const diffRows = container.querySelectorAll('tr.diff-line-row, tr[data-hunk], tr.js-diff-row, tr[class*="diff"]');
        
        diffRows.forEach(row => {
          // Skip hunk header rows
          if (row.querySelector('td.diff-hunk-cell, td.hunk')) {
            return;
          }
          
          // look for cells with specific background colors and classes
          const additionCell = row.querySelector('td[style*="diffBlob-addition"], .addition, td.blob-code-addition, td[data-line-type="addition"]');
          const deletionCell = row.querySelector('td[style*="diffBlob-deletion"], .deletion, td.blob-code-deletion, td[data-line-type="deletion"]');
          const contextCell = row.querySelector('td.blob-code-context, td[data-line-type="context"]');
          
          // check for diff markers and background colors
          const cells = row.querySelectorAll('td');
          let lineType = 'context';
          let content = '';
          let lineNumber = '';
          
          // Look for addition markers
          if (additionCell || row.querySelector('span.diff-text-marker')) {
            const marker = row.querySelector('span.diff-text-marker');
            if (marker && marker.textContent === '+') {
              lineType = 'addition';
            }
          }
          
          // Look for deletion markers  
          if (deletionCell || (row.querySelector('span.diff-text-marker') && row.querySelector('span.diff-text-marker').textContent === '-')) {
            lineType = 'deletion';
          }
          
          // Extract content from the rightmost content cell
          for (let i = cells.length - 1; i >= 0; i--) {
            const cell = cells[i];
            if (cell.classList.contains('diff-text-cell') || cell.querySelector('.diff-text-inner')) {
              const innerDiv = cell.querySelector('.diff-text-inner');
              if (innerDiv) {
                content = innerDiv.textContent.trim();
                // Remove the diff marker if it's at the start
                if (content.startsWith('+') || content.startsWith('-')) {
                  content = content.substring(1).trim();
                }
                break;
              } else if (cell.textContent.trim()) {
                content = cell.textContent.trim();
                break;
              }
            }
          }
          
          // Extract line number from leftmost cells
          for (let i = 0; i < Math.min(2, cells.length); i++) {
            const cell = cells[i];
            if (cell.classList.contains('diff-line-number') && cell.textContent.trim() && /^\d+$/.test(cell.textContent.trim())) {
              lineNumber = cell.textContent.trim();
              break;
            }
          }
          
          // Add the line if we found content
          if (content) {
            diffLines.push({
              type: lineType,
              lineNumber: lineNumber || '',
              content: content
            });
          }
          
          if (!content && cells.length >= 4) {
            const leftContent = cells[1]?.textContent?.trim() || '';
            const rightContent = cells[3]?.textContent?.trim() || '';
            
            let fallbackType = 'context';
            if (row.classList.contains('addition') || row.querySelector('.addition')) {
              fallbackType = 'addition';
            } else if (row.classList.contains('deletion') || row.querySelector('.deletion')) {
              fallbackType = 'deletion';
            }
            
            const fallbackContent = rightContent || leftContent;
            if (fallbackContent) {
              diffLines.push({
                type: fallbackType,
                lineNumber: cells[0]?.textContent?.trim() || cells[2]?.textContent?.trim() || '',
                content: fallbackContent
              });
            }
          }
        });
        
        if (diffLines.length > 0) {
          diffData.push({
            fileName,
            changes: diffLines
          });
        }
      });
      
      return diffData;
    }
  
    // Format diff data for LLM
    formatDiffForLLM(prInfo, diffData) {
      let output = `PR Diff: ${prInfo.title} (#${prInfo.prNumber})\n\n`;
      
      // Add PR description if available
      const description = this.getPRDescription();
      if (description) {
        output += `Description:\n${description}\n\n`;
      }
      
      diffData.forEach(file => {
        output += `[${file.fileName}]\n`;
        
        file.changes.forEach(change => {
          const prefix = change.type === 'addition' ? '+' : 
                       change.type === 'deletion' ? '-' : ' ';
          output += `${prefix} ${change.content}\n`;
        });
        
        output += '\n';
      });
      
      return output;
    }

    // Extract PR description
    getPRDescription() {
      const descriptionSelectors = [
        '.prc-PageHeader-Description-TQgfF',
        '.js-issue-body',
        '.comment-body',
        '[data-testid="pull-request-description"]'
      ];
      
      for (const selector of descriptionSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          if (text && text.length > 10) {
            return text;
          }
        }
      }
      
      return null;
    }
  
    // Check if we're on the files page
    isOnFilesPage() {
      return window.location.href.includes('/files');
    }

    // Navigate to the files page
    navigateToFiles() {
      this.pendingExtraction = true;
      const url = window.location.href;
      const filesUrl = url.replace(/\/pull\/(\d+).*/, '/pull/$1/files');
      window.location.href = filesUrl;
    }

    // Perform the actual extraction and copy
    async performExtraction() {
      const originalText = this.button.querySelector('.llm-diff-text').textContent;
      
      try {
        const prInfo = this.getPRInfo();
        let diffData = [];
        
        // Try API extraction first
        try {
          this.button.querySelector('.llm-diff-text').textContent = 'Fetching from API...';
          diffData = await this.extractDiffDataFromAPI();
        } catch (apiError) {
          console.log('API extraction failed, falling back to DOM:', apiError.message);
          // Fall back to DOM extraction
          this.button.querySelector('.llm-diff-text').textContent = 'Extracting from page...';
          diffData = this.extractDiffData();
        }
        
        if (diffData.length === 0) {
          // If both API and DOM failed, offer navigation option
          if (!this.isOnFilesPage()) {
            this.button.querySelector('.llm-diff-text').textContent = 'Go to Files?';
            this.button.disabled = false;
            this.isProcessing = false;
            
            // Change button behavior temporarily
            const originalHandler = this.button.onclick;
            this.button.onclick = () => {
              this.button.onclick = originalHandler;
              this.pendingExtraction = true;
              this.navigateToFiles();
            };
            return;
          } else {
            throw new Error('No diff data found. Ensure this PR has file changes.');
          }
        }
        
        const formattedDiff = this.formatDiffForLLM(prInfo, diffData);
        
        if (!formattedDiff || formattedDiff.trim().length < 20) {
          throw new Error('Extracted diff appears to be empty or too short.');
        }
        
        // Check clipboard API availability
        if (!navigator.clipboard) {
          throw new Error('Clipboard API not available. Try using HTTPS.');
        }
        
        await navigator.clipboard.writeText(formattedDiff);
        
        console.log(`Successfully copied diff for PR #${prInfo.prNumber} (${diffData.length} files)`);
        
        // Show success feedback
        this.button.querySelector('.llm-diff-text').textContent = 'Copied!';
        setTimeout(() => {
          if (this.button && this.button.querySelector('.llm-diff-text')) {
            this.button.querySelector('.llm-diff-text').textContent = originalText;
          }
        }, 2000);
        
      } catch (error) {
        console.error('Failed to copy diff:', error);
        
        // More specific error messages
        let errorText = 'Error';
        if (error.message.includes('Clipboard API')) {
          errorText = 'No HTTPS';
        } else if (error.message.includes('No diff data')) {
          errorText = 'No diff';
        } else if (error.message.includes('empty')) {
          errorText = 'Empty';
        }
        
        this.button.querySelector('.llm-diff-text').textContent = errorText;
        setTimeout(() => {
          if (this.button && this.button.querySelector('.llm-diff-text')) {
            this.button.querySelector('.llm-diff-text').textContent = originalText;
          }
        }, 3000);
      } finally {
        this.button.disabled = false;
        this.isProcessing = false;
        this.pendingExtraction = false;
      }
    }

    // Handle copy button click
    async handleCopyClick() {
      if (this.isProcessing) return;
      
      this.isProcessing = true;

      const originalText = this.button.querySelector('.llm-diff-text').textContent;
      this.button.querySelector('.llm-diff-text').textContent = 'Starting...';
      this.button.disabled = true;
      
      // Always try the API-first approach
      await this.performExtraction();
    }
  
    // Initialize the extension
    init() {
      if (!this.isPRPage()) return;
      
      // Wait for page to load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.insertButton());
      } else {
        this.insertButton();
      }
      
      // Handle navigation within GitHub (SPA)
      const observer = new MutationObserver(() => {
        if (this.isPRPage() && !this.button) {
          setTimeout(() => this.insertButton(), 1000);
        } else if (!this.isPRPage() && this.button) {
          this.button.remove();
          this.button = null;
        }
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      
      // Listen for popstate events (back/forward navigation)
      window.addEventListener('popstate', () => {
        setTimeout(() => {
          if (this.isPRPage() && !this.button) {
            this.insertButton();
          }
        }, 500);
      });
    }
  }
  
  // Initialize the extension
  const extractor = new GitHubPRDiffExtractor();
  extractor.init();