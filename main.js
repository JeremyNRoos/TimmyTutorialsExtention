(function() {
    const vscode = acquireVsCodeApi();
    
    let sessionId = null;
    let pdfText = '';

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

    // Event listeners
    startBtn.addEventListener('click', startTutorial);
    uploadPdfBtn.addEventListener('click', uploadPDF);
    nextStepBtn.addEventListener('click', () => sendMessage('next'));
    sendQuestionBtn.addEventListener('click', sendQuestion);
    questionInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendQuestion();
    });

    function startTutorial() {
        const prompt = promptInput.value.trim();
        if (!prompt && !pdfText) {
            showError('Please provide a prompt or upload a PDF');
            return;
        }

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

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
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

    function renderStep(message) {
        const blocks = parseCodeBlocks(message);
        const explanation = message.replace(/```(\w+)?\n[\s\S]*?```/g, '').trim();

        // Render code
        if (blocks.length > 0) {
            codeContent.textContent = blocks[0].code;
            codeContent.className = `language-${blocks[0].language}`;
        }

        // Render explanation
        const entry = document.createElement('div');
        entry.className = 'explanation-entry';
        entry.innerHTML = `<p>${explanation.replace(/\n/g, '<br>')}</p>`;
        explanationHistory.appendChild(entry);
        entry.scrollIntoView({ behavior: 'smooth' });
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
                break;

            case 'tutorialContinued':
                renderStep(message.message);
                nextStepBtn.disabled = false;
                sendQuestionBtn.disabled = false;
                break;

            case 'pdfProcessed':
                pdfText = message.text;
                uploadPdfBtn.textContent = 'PDF Uploaded ✓';
                uploadPdfBtn.style.backgroundColor = '#4CAF50';
                break;

            case 'error':
                showError(message.message);
                startBtn.disabled = false;
                startBtn.textContent = 'Start Tutorial';
                nextStepBtn.disabled = false;
                sendQuestionBtn.disabled = false;
                break;
        }
    });
})();