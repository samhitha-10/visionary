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
    statusDiv.innerText = "Connecting Camera...";
    statusDiv.style.borderColor = "yellow";

    try {
        let stream;
        // Try Back -> Front -> Any
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });
        } catch (e) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: false
                });
            } catch (e2) {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
        }

        video.srcObject = stream;
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        });

    } catch (err) {
        alert("Camera Error: " + err.message);
        console.error(err);
        throw err;
    }
}

// 2. Load AI Model
async function loadModel() {
    statusDiv.innerText = "Loading AI Model...";
    try {
        model = await cocoSsd.load();
        isModelLoaded = true;
        statusDiv.innerText = "System Active";
        statusDiv.style.borderColor = "#0f0";
        
        // Hide start screen, show canvas
        startScreen.style.display = 'none';
        canvas.style.display = 'block';
        
        speak("Eye Guide Ready");
        detectFrame();
    } catch (err) {
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
    const predictions = await model.detect(video);
    drawPredictions(predictions);
    handleVoice(predictions);
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

// --- NEW: START BUTTON LOGIC ---
startBtn.addEventListener('click', () => {
    console.log("Button clicked, starting...");
    setupCamera().then(() => {
        loadModel();
    });
});
