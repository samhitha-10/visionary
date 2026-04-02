const video = document.getElementById('webcam');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const loadingDiv = document.getElementById('loading');

let model = undefined;
let isModelLoaded = false;

// 1. Setup the Camera
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }, // Use back camera on mobile
            audio: false
        });
        video.srcObject = stream;
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        });
    } catch (err) {
        alert("Camera Error: Please allow camera access. " + err);
    }
}

// 2. Load the AI Model (COCO-SSD)
async function loadModel() {
    statusDiv.innerText = "Loading AI Model...";
    // Load the model from the CDN
    model = await cocoSsd.load();
    isModelLoaded = true;
    statusDiv.innerText = "System Active";
    statusDiv.style.borderColor = "#0f0"; // Green border
    loadingDiv.style.display = "none"; // Hide loading text
    speak("Eye Guide Ready");
    
    // Start the detection loop
    detectFrame();
}

// 3. The Main Loop (Run this forever)
async function detectFrame() {
    if (!isModelLoaded || video.paused || video.ended) {
        return; // Wait for model or video
    }

    // Match canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame onto the canvas first
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Run AI Detection
    const predictions = await model.detect(video);

    // Draw the boxes and labels
    drawPredictions(predictions);

    // Speak important items (Simple logic to avoid spam)
    handleVoice(predictions);

    // Loop again
    requestAnimationFrame(detectFrame);
}

// 4. Draw the Green Boxes
function drawPredictions(predictions) {
    ctx.font = '18px Arial';
    ctx.textBaseline = 'top';

    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        const label = prediction.class;
        const score = Math.round(prediction.score * 100) + '%';

        // Draw Rectangle
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, width, height);

        // Draw Label Background
        ctx.fillStyle = '#00ff00';
        const textWidth = ctx.measureText(`${label} ${score}`).width;
        ctx.fillRect(x, y, textWidth + 10, 25);

        // Draw Text
        ctx.fillStyle = '#000000';
        ctx.fillText(`${
