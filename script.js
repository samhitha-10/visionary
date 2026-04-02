// --- DIAGNOSTIC VERSION ---

const video = document.getElementById('webcam');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');

let model = undefined;
let isModelLoaded = false;

// 1. Setup the Camera
async function setupCamera() {
    alert("Step 1: Trying to access Camera...");
    statusDiv.innerText = "Connecting Camera...";
    statusDiv.style.borderColor = "yellow";

    try {
        let stream;
        // Try Back Camera
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });
            alert("Step 1a: Back Camera found!");
        } catch (e) {
            alert("Step 1b: Back camera failed. Trying Front...");
            // Try Front Camera
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: false
                });
                alert("Step 1c: Front Camera found!");
            } catch (e2) {
                alert("Step 1d: Front camera failed. Trying Default...");
                // Try Default
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
        }

        video.srcObject = stream;
        
        // Wait for video to be ready
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                alert("Step 1e: Video is ready!");
                resolve(video);
            };
        });

    } catch (err) {
        alert("CRITICAL ERROR: Camera blocked or missing.\n\nReason: " + err.message);
        console.error(err);
        throw err;
    }
}

// 2. Load AI Model
async function loadModel() {
    alert("Step 2: Loading AI Model (this might take 10 seconds)...");
    statusDiv.innerText = "Loading AI Model...";
    try {
        model = await cocoSsd.load();
        isModelLoaded = true;
        alert("Step 2b: AI Model Loaded Successfully!");
        
        statusDiv.innerText = "System Active";
        statusDiv.style.borderColor = "#0f0";
        
        // Hide Start Screen
        startScreen.style.display = 'none';
        canvas.style.display = 'block';
        
        speak("Eye Guide Ready");
        detectFrame();
    } catch (err) {
        alert("ERROR: Could not load AI Model.\n\nReason: " + err.message + "\n\nIf this says 'Failed to fetch', your network might be blocking the download.");
        console.error(err);
        statusDiv.innerText = "AI Model Error";
    }
}

// 3. The Loop
async function detectFrame() {
    if (!isModelLoaded || video.paused || video.ended || video.readyState < 2) {
        requestAnimationFrame(detectFrame);
        return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
        const predictions = await model.detect(video);
        drawPredictions(predictions);
        handleVoice(predictions);
    } catch (e) {
        // Silent fail in loop to avoid spamming alerts
    }
    requestAnimationFrame(detectFrame);
}

// 4. Draw Boxes
function drawPredictions(predictions) {
    ctx.font = 'bold 18px Arial';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        ctx.strokeStyle = '#00ff00';
        ctx.strokeRect(x, y, width, height);
        
        ctx.fillStyle = '#00ff00';
        const text = `${prediction.class} ${(prediction.score * 100).toFixed(0)}%`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(x, y, textWidth + 10, 25);
        
        ctx.fillStyle = '#000';
        ctx.fillText(text, x + 5, y + 4);
    });
}

// 5. Voice
let lastSpokenTime = 0;
function handleVoice(predictions) {
    const now = Date.now();
    if (now - lastSpokenTime < 3000) return;
    for (let prediction of predictions) {
        if (prediction.score > 0.6) {
            if (['person', 'chair', 'cell phone', 'bottle'].includes(prediction.class)) {
                speak(`${prediction.class} detected`);
                lastSpokenTime = now;
                break;
            }
        }
    }
}
function speak(text) {
    if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(u);
    }
}

// --- CLICK HANDLER ---
startBtn.addEventListener('click', () => {
    alert("Button Clicked! Starting sequence...");
    setupCamera().then(() => {
        loadModel();
    });
});
