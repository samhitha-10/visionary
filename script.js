const video = document.getElementById('webcam');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const loadingDiv = document.getElementById('loading');

let model = undefined;
let isModelLoaded = false;

// 1. Setup the Camera with Fallback Logic
async function setupCamera() {
    loadingDiv.innerHTML = "Accessing Camera...<br>Please allow permission.";
    statusDiv.innerText = "Connecting Camera...";
    statusDiv.style.borderColor = "yellow";

    try {
        let stream;

        // STRATEGY 1: Try Back Camera (Environment) - Good for Mobile
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
                audio: false
            });
            console.log("Using Back Camera");
        } catch (e) {
            console.warn("Back camera not found, trying front camera...", e);
            
            // STRATEGY 2: Try Front Camera (User) - Good for Laptops/Desktops
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: 'user' },
                    audio: false
                });
                console.log("Using Front Camera");
            } catch (e2) {
                console.warn("Front camera failed, trying default...", e2);
                
                // STRATEGY 3: Just give me any video!
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
                console.log("Using Default Camera");
            }
        }

        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        });

    } catch (err) {
        console.error("Camera Access Error:", err);
        statusDiv.innerText = "Camera Blocked: " + err.message;
        statusDiv.style.color = "red";
        statusDiv.style.borderColor = "red";
        loadingDiv.innerHTML = "<span style='color:red'>Camera Access Denied.<br>Please click the lock icon in your address bar and allow camera access.</span>";
        throw err; // Stop execution
    }
}

// 2. Load the AI Model
async function loadModel() {
    statusDiv.innerText = "Loading AI Model...";
    try {
        // Load the pre-trained COCO-SSD model
        model = await cocoSsd.load();
        isModelLoaded = true;
        
        statusDiv.innerText = "System Active";
        statusDiv.style.color = "#0f0";
        statusDiv.style.borderColor = "#0f0";
        loadingDiv.style.display = "none";
        
        speak("Eye Guide Ready");
        
        // Start the loop
        detectFrame();
    } catch (err) {
        console.error("Model Load Error:", err);
        statusDiv.innerText = "AI Model Error";
    }
}

// 3. The Detection Loop
async function detectFrame() {
    // Safety check: ensure video and model are ready
    if (!isModelLoaded || video.paused || video.ended || video.readyState < 2) {
        requestAnimationFrame(detectFrame);
        return;
    }

    // Resize canvas to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw Video
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Detect Objects
    const predictions = await model.detect(video);

    // Draw Boxes
    drawPredictions(predictions);

    // Voice Output
    handleVoice(predictions);

    // Repeat
    requestAnimationFrame(detectFrame);
}

// 4. Draw Green Boxes
function drawPredictions(predictions) {
    ctx.font = 'bold 18px Arial';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;

    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        const label = prediction.class;
        const score = Math.round(prediction.score * 100) + '%';

        // Draw Box
        ctx.strokeStyle = '#00ff00'; // Neon Green
        ctx.strokeRect(x, y, width, height);

        // Draw Label Background
        ctx.fillStyle = '#00ff00';
        const text = `${label} ${score}`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(x, y, textWidth + 10, 25);

        // Draw Text
        ctx.fillStyle = '#000000';
        ctx.fillText(text, x + 5, y + 4);
    });
}

// 5. Voice Logic
let lastSpokenTime = 0;

function handleVoice(predictions) {
    const now = Date.now();
    // Throttle: Only speak every 3 seconds
    if (now - lastSpokenTime < 3000) return;

    for (let prediction of predictions) {
        // Only speak if confidence is high (> 60%)
        if (prediction.score > 0.6) {
            const label = prediction.class;
            
            // Custom priority for important objects
            if (label === 'person') {
                speak("Person ahead");
                lastSpokenTime = now;
                break;
            } else if (label === 'cell phone') {
                speak("Phone detected");
                lastSpokenTime = now;
                break;
            } else if (label === 'chair') {
                speak("Chair ahead");
                lastSpokenTime = now;
                break;
            } else if (label === 'bottle') {
                speak("Bottle detected");
                lastSpokenTime = now;
                break;
            }
        }
    }
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0; // Normal speed
        utterance.pitch = 1.0; // Normal pitch
        window.speechSynthesis.speak(utterance);
    }
}

// Initialize
setupCamera().then(() => {
    loadModel();
});
