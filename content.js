// Content script for GitHub PR Diff LLM extension

class GitHubPRDiffExtractor {
    constructor() {
      this.button = null;
      this.isProcessing = false;
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
    }
  
    // Extract PR title and number
    getPRInfo() {
      const titleElement = document.querySelector('.prc-PageHeader-Title-LKOsd, .js-issue-title');
      const title = titleElement ? titleElement.textContent.trim() : 'Unknown PR';
      
      const url = window.location.href;
      const prNumberMatch = url.match(/\/pull\/(\d+)/);
      const prNumber = prNumberMatch ? prNumberMatch[1] : 'unknown';
      
      return { title, prNumber };
    }
  
    // Extract diff data from the page
    extractDiffData() {
      const diffData = [];
      
      // Look for file diff containers using multiple selectors
      const diffContainers = document.querySelectorAll('[data-diff-anchor], .file-diff, .js-file-diff-split');
      
      diffContainers.forEach(container => {
        // Try multiple selectors for file name
        const fileHeader = container.querySelector(
          '.DiffFileHeader-module__file-name--mY1O5, .file-header, [data-path], .file-info a'
        );
        if (!fileHeader) return;
        
        const fileName = fileHeader.getAttribute('data-path') || fileHeader.textContent.trim();
        const diffLines = [];
        
        // Extract diff lines using multiple approaches
        const diffRows = container.querySelectorAll('tr[data-hunk], tr.js-diff-row, tr[class*="diff"]');
        
        diffRows.forEach(row => {
          // Handle both split and unified diff views
          const additionCell = row.querySelector('td.blob-code-addition, td[data-line-type="addition"]');
          const deletionCell = row.querySelector('td.blob-code-deletion, td[data-line-type="deletion"]');
          const contextCell = row.querySelector('td.blob-code-context, td[data-line-type="context"]');
          
          if (additionCell) {
            const lineNumber = row.querySelector('td[data-line-number]')?.textContent?.trim();
            diffLines.push({
              type: 'addition',
              lineNumber: lineNumber || '',
              content: additionCell.textContent.trim()
            });
          } else if (deletionCell) {
            const lineNumber = row.querySelector('td[data-line-number]')?.textContent?.trim();
            diffLines.push({
              type: 'deletion',
              lineNumber: lineNumber || '',
              content: deletionCell.textContent.trim()
            });
          } else if (contextCell) {
            const lineNumber = row.querySelector('td[data-line-number]')?.textContent?.trim();
            diffLines.push({
              type: 'context',
              lineNumber: lineNumber || '',
              content: contextCell.textContent.trim()
            });
          }
          
          // Fallback: try the old approach for backward compatibility
          const cells = row.querySelectorAll('td');
          if (cells.length >= 4 && diffLines.length === 0) {
            const leftContent = cells[1]?.textContent?.trim() || '';
            const rightContent = cells[3]?.textContent?.trim() || '';
            
            let lineType = 'context';
            if (row.classList.contains('addition') || row.querySelector('.addition')) {
              lineType = 'addition';
            } else if (row.classList.contains('deletion') || row.querySelector('.deletion')) {
              lineType = 'deletion';
            }
            
            const content = rightContent || leftContent;
            if (content) {
              diffLines.push({
                type: lineType,
                lineNumber: cells[0]?.textContent?.trim() || cells[2]?.textContent?.trim() || '',
                content: content
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
  
    // Handle copy button click
    async handleCopyClick() {
      if (this.isProcessing) return;
      
      this.isProcessing = true;
      const originalText = this.button.querySelector('.llm-diff-text').textContent;
      this.button.querySelector('.llm-diff-text').textContent = 'Copying...';
      this.button.disabled = true;
      
      try {
        const prInfo = this.getPRInfo();
        const diffData = this.extractDiffData();
        
        if (diffData.length === 0) {
          throw new Error('No diff data found. Try navigating to the "Files changed" tab or ensure this PR has file changes.');
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
      }
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
    }
  }
  
  // Initialize the extension
  const extractor = new GitHubPRDiffExtractor();
  extractor.init();