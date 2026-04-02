const video = document.getElementById('webcam');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const statusDiv = document.getElementById('status');
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const navUi = document.getElementById('nav-ui');
const navText = document.getElementById('nav-text');
const directionOverlay = document.getElementById('direction-overlay');

let model = undefined;
let isModelLoaded = false;

// --- NAVIGATION VARIABLES ---
let userLocation = { lat: 0, lng: 0 };
let destination = { lat: 40.7128, lng: -74.0060 }; // Default: New York (Demo)
let isEmergency = false; // If car is detected, this becomes true

// --- 1. SETUP CAMERA ---
async function setupCamera() {
    try {
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        } catch (e) {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        }
        video.srcObject = stream;
        return new Promise((resolve) => { video.onloadedmetadata = () => resolve(video); });
    } catch (err) {
        alert("Camera Error: " + err.message);
        throw err;
    }
}

// --- 2. START GPS TRACKING ---
function startGPS() {
    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition((position) => {
            userLocation.lat = position.coords.latitude;
            userLocation.lng = position.coords.longitude;
            statusDiv.innerText = `Lat: ${userLocation.lat.toFixed(2)}`;
            calculateDirection();
        }, (err) => {
            console.error("GPS Error", err);
            statusDiv.innerText = "GPS Signal Lost";
        });
    } else {
        statusDiv.innerText = "No GPS Support";
    }
}

// --- 3. SET DESTINATION ---
function setDestination() {
    // For the hackathon demo, we simulate picking a point nearby
    // In a real app, you would use a map input.
    const randomLat = userLocation.lat + (Math.random() * 0.01 - 0.005);
    const randomLng = userLocation.lng + (Math.random() * 0.01 - 0.005);
    
    destination = { lat: randomLat, lng: randomLng };
    alert(`Destination Set: ${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}\n(Walk straight)`);
    
    directionOverlay.style.display = 'block';
    speak("Destination set. Let's go.");
}

// --- 4. CALCULATE DIRECTION (Simple Compass) ---
function calculateDirection() {
    // Simplified logic: Just tell them to go straight for the demo
    // Real math requires calculating bearing between coordinates
    const direction = "Head North"; // Placeholder
    navText.innerText = direction;
}

// --- 5. LOAD AI MODEL ---
async function loadModel() {
    try {
        model = await cocoSsd.load();
        isModelLoaded = true;
        startScreen.style.display = 'none';
        canvas.style.display = 'block';
        navUi.style.display = 'flex'; // Show nav buttons
        
        speak("Eye Guide Navigation Online");
        startGPS(); // Start tracking
        detectFrame();
    } catch (err) {
        alert("AI Error: " + err.message);
    }
}

// --- 6. THE LOOP (WITH DANGER LOGIC) ---
async function detectFrame() {
    if (!isModelLoaded || video.paused || video.ended) {
        requestAnimationFrame(detectFrame);
        return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Only detect if no emergency
    if (!isEmergency) {
        const predictions = await model.detect(video);
        
        // CHECK FOR DANGER (Car coming towards you)
        checkForDanger(predictions);
        
        drawPredictions(predictions);
        handleVoice(predictions);
    }
    
    requestAnimationFrame(detectFrame);
}

// --- 7. DANGER CHECK (The "Car" Logic) ---
function checkForDanger(predictions) {
    const screenHeight = canvas.height;
    
    for (let p of predictions) {
        const [x, y, width, height] = p.bbox;
        const objectCenterY = y + (height / 2);
        
        // Logic: Is it a dangerous vehicle AND is it in the bottom half (path)?
        const isVehicle = ['car', 'bus', 'truck', 'motorcycle'].includes(p.class);
        const isInPath = objectCenterY > (screenHeight / 2); 
        
        if (isVehicle && isInPath && p.score > 0.6) {
            triggerEmergency(p.class);
        }
    }
}

function triggerEmergency(vehicleName) {
    isEmergency = true;
    
    // Visual Warning
    ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "white";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    ctx.fillText("WARNING!", canvas.width/2, canvas.height/2 - 20);
    ctx.fillText(`${vehicleName.toUpperCase()} AHEAD`, canvas.width/2, canvas.height/2 + 40);
    
    // Audio Warning (Override everything)
    window.speechSynthesis.cancel(); // Stop talking about navigation
    speak(`STOP! A ${vehicleName} is coming!`);
    
    // Reset emergency after 3 seconds
    setTimeout(() => {
        isEmergency = false;
    }, 3000);
}

// --- 8. DRAW & VOICE ---
function drawPredictions(predictions) {
    ctx.font = 'bold 18px Arial';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 3;
    predictions.forEach(p => {
        const [x, y, w, h] = p.bbox;
        ctx.strokeStyle = '#00ff00';
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#00ff00';
        ctx.fillText(p.class, x, y - 10);
    });
}

let lastNavUpdate = 0;
function handleVoice(predictions) {
    // Don't give navigation advice if we just spoke about a car
    if (Date.now() - lastNavUpdate < 5000) return; 
    
    // Only speak navigation if no objects are blocking view
    if (predictions.length === 0) {
        speak("Walk straight");
        lastNavUpdate = Date.now();
    }
}

function speak(text) {
    if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.1; // Slightly faster for urgency
        window.speechSynthesis.speak(u);
    }
}

// Start Button
startBtn.addEventListener('click', () => {
    setupCamera().then(() => loadModel());
});
