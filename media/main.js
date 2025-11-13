(function() {
    const vscode = acquireVsCodeApi();
    
    let sessionId = null;
    let pdfText = '';

    // Inject Highlight.js + styles dynamically
    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark-dimmed.min.css';
    document.head.appendChild(styleLink);

    const hljsScript = document.createElement('script');
    hljsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
    hljsScript.onload = () => {
        window.hljs?.highlightAll();
    };
    document.head.appendChild(hljsScript);

    const style = document.createElement('style');
    style.textContent = `
        pre {
            background-color: #1e1e1e;
            color: #ddd;
            padding: 12px;
            border-radius: 8px;
            overflow-x: auto;
            font-family: 'Consolas', monospace;
            line-height: 1.5;
            margin-top: 10px;
            white-space: pre;
        }
        code {
            font-family: 'Consolas', monospace;
            font-size: 0.9rem;
        }
        .hljs-comment, .hljs-quote { color: #6a9955; }
        .hljs-keyword, .hljs-selector-tag, .hljs-subst { color: #569cd6; }
        .hljs-string, .hljs-title, .hljs-name, .hljs-type { color: #ce9178; }
        .code-container {
            background: #252526;
            border-radius: 10px;
            padding: 16px;
            margin-top: 10px;
        }
    `;
    document.head.appendChild(style);

    // Get DOM elements
    const startView = document.getElementById('start-view');
    const tutorialView = document.getElementById('tutorial-view');
    const promptInput = document.getElementById('prompt-input');
    const uploadPdfBtn = document.getElementById('upload-pdf-btn');
    const startBtn = document.getElementById('start-btn');
    const codeContent = document.getElementById('code-content');
    const explanationHistory = document.getElementById('explanation-history');
    const questionInput = document.getElementById('question-input');
    const nextStepBtn = document.getElementById('next-step-btn');
    const sendQuestionBtn = document.getElementById('send-question-btn');
    const errorMessage = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');
    const loading = document.getElementById('loading');
    const resetBtn = document.getElementById('reset-btn');
    const copyCodeBtn = document.getElementById('copy-code-btn');

    // Event listeners
    startBtn.addEventListener('click', startTutorial);
    uploadPdfBtn.addEventListener('click', uploadPDF);
    nextStepBtn.addEventListener('click', () => sendMessage('next'));
    sendQuestionBtn.addEventListener('click', sendQuestion);
    resetBtn.addEventListener('click', resetTutorial);
    copyCodeBtn.addEventListener('click', copyCode);
    
    questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendQuestion();
        }
    });

    function startTutorial() {
        const prompt = promptInput.value.trim();
        if (!prompt && !pdfText) {
            showError('Please provide a prompt or upload a PDF');
            return;
        }

        showLoading(true);
        
        vscode.postMessage({
            type: 'startTutorial',
            prompt: prompt,
            pdfText: pdfText
        });

        startBtn.disabled = true;
        startBtn.textContent = 'Starting...';
    }

    function uploadPDF() {
        vscode.postMessage({ type: 'uploadPDF' });
    }

    function sendMessage(message) {
        if (!sessionId) return;

        showLoading(true);

        vscode.postMessage({
            type: 'continueTutorial',
            sessionId: sessionId,
            userMessage: message
        });

        nextStepBtn.disabled = true;
        sendQuestionBtn.disabled = true;
    }

    function sendQuestion() {
        const question = questionInput.value.trim();
        if (!question) return;
        sendMessage(question);
        questionInput.value = '';
    }

    function resetTutorial() {
        sessionId = null;
        pdfText = '';
        startView.style.display = 'block';
        tutorialView.style.display = 'none';
        explanationHistory.innerHTML = '';
        codeContent.textContent = '// Code will appear here...';
        promptInput.value = '';
        questionInput.value = '';
        uploadPdfBtn.textContent = '📄 Upload PDF';
        uploadPdfBtn.style.backgroundColor = '';
        startBtn.disabled = false;
        startBtn.textContent = '▶️ Start Tutorial';
        hideError();
        showLoading(false);
        
        vscode.postMessage({ type: 'reset' });
        saveState();
    }

    function copyCode() {
        const code = codeContent.textContent;
        navigator.clipboard.writeText(code).then(() => {
            copyCodeBtn.textContent = '✓ Copied!';
            setTimeout(() => {
                copyCodeBtn.textContent = '📋 Copy';
            }, 2000);
        }).catch(() => {
            showError('Failed to copy code to clipboard');
        });
    }

    function showError(message) {
        errorText.textContent = message;
        errorMessage.style.display = 'flex';
        setTimeout(hideError, 5000);
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }

    function showLoading(show) {
        loading.style.display = show ? 'flex' : 'none';
    }

    function parseCodeBlocks(content) {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        const blocks = [];
        let match;
        while ((match = codeBlockRegex.exec(content)) !== null) {
            blocks.push({
                language: match[1] || 'text',
                code: match[2].trim()
            });
        }
        return blocks;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function renderStep(message) {
        const blocks = parseCodeBlocks(message);
        const explanation = message.replace(/```(\w+)?\n[\s\S]*?```/g, '').trim();

        // Render code block with highlight.js
        if (blocks.length > 0) {
            const codeBlock = document.createElement('pre');
            const codeTag = document.createElement('code');
            codeTag.className = `language-${blocks[0].language}`;
            codeTag.textContent = blocks[0].code;
            codeBlock.appendChild(codeTag);

            codeContent.innerHTML = '';
            codeContent.classList.add('code-container');
            codeContent.appendChild(codeBlock);

            if (window.hljs) hljs.highlightElement(codeTag);
        }

        // Render explanation text
        const entry = document.createElement('div');
        entry.className = 'explanation-entry';
        
        const stepNumber = document.createElement('div');
        stepNumber.className = 'step-number';
        stepNumber.textContent = `Step ${explanationHistory.children.length + 1}`;
        entry.appendChild(stepNumber);

        const paragraphs = explanation.split(/\n\n+/);
        paragraphs.forEach(para => {
            const p = document.createElement('p');
            let html = escapeHtml(para)
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/`(.*?)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>');
            p.innerHTML = html;
            entry.appendChild(p);
        });
        
        explanationHistory.appendChild(entry);
        entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
        const message = event.data;

        switch (message.type) {
            case 'tutorialStarted':
                sessionId = message.sessionId;
                startView.style.display = 'none';
                tutorialView.style.display = 'block';
                renderStep(message.message);
                nextStepBtn.disabled = false;
                sendQuestionBtn.disabled = false;
                showLoading(false);
                saveState();
                break;

            case 'tutorialContinued':
                renderStep(message.message);
                nextStepBtn.disabled = false;
                sendQuestionBtn.disabled = false;
                showLoading(false);
                saveState();
                break;

            case 'pdfProcessed':
                pdfText = message.text;
                uploadPdfBtn.textContent = '✓ PDF Uploaded';
                uploadPdfBtn.style.backgroundColor = '#4CAF50';
                saveState();
                break;

            case 'error':
                showError(message.message);
                startBtn.disabled = false;
                startBtn.textContent = '▶️ Start Tutorial';
                nextStepBtn.disabled = false;
                sendQuestionBtn.disabled = false;
                showLoading(false);
                break;

            case 'reset':
                resetTutorial();
                break;
                
            case 'fileChange':
                showFileChange(message.file, message.changes);
                break;
        }
    });

    function showFileChange(file, changes) {
        const entry = document.createElement('div');
        entry.className = 'file-change-entry';
        entry.innerHTML = `
            <div class="file-change-header">
                <span class="file-icon">📝</span>
                <span class="file-name">${escapeHtml(file)}</span>
            </div>
            <div class="file-change-actions">
                <button class="accept-btn" onclick="handleFileAction('${escapeHtml(file)}', 'accept')">✓ Accept</button>
                <button class="reject-btn" onclick="handleFileAction('${escapeHtml(file)}', 'reject')">✗ Reject</button>
            </div>
        `;
        explanationHistory.appendChild(entry);
        entry.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    window.handleFileAction = function(file, action) {
        vscode.postMessage({
            type: 'fileAction',
            file: file,
            action: action
        });
    };

    // Save and restore session state
    function saveState() {
        vscode.setState({ sessionId, pdfText });
    }

    const previousState = vscode.getState();
    if (previousState) {
        sessionId = previousState.sessionId;
        pdfText = previousState.pdfText || '';
        if (pdfText) {
            uploadPdfBtn.textContent = '✓ PDF Uploaded';
            uploadPdfBtn.style.backgroundColor = '#4CAF50';
        }
    }
})();
