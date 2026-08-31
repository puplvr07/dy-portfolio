// Camera Access for About Me Section with Hand Tracking
let cameraStream = null;
let handDetectionActive = false;
let canvas = null;
let canvasCtx = null;
let camera = null;
let hands = null;

// Load MediaPipe Hands
function loadMediaPipe() {
    return Promise.all([
        new Promise(resolve => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.4/camera_utils.js';
            script.onload = resolve;
            document.head.appendChild(script);
        }),
        new Promise(resolve => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.4/drawing_utils.js';
            script.onload = resolve;
            document.head.appendChild(script);
        }),
        new Promise(resolve => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js';
            script.onload = resolve;
            document.head.appendChild(script);
        })
    ]);
}

// Initialize hand detection
async function initializeHandDetection() {
    try {
        await loadMediaPipe();
        
        const video = document.getElementById('camera-feed');
        
        // Wait for video to be ready
        if (video.videoWidth === 0) {
            setTimeout(initializeHandDetection, 100);
            return;
        }
        
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'hand-canvas';
            canvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                border-radius: 10px;
            `;
            document.getElementById('camera-feed-container').style.position = 'relative';
            document.getElementById('camera-feed-container').appendChild(canvas);
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvasCtx = canvas.getContext('2d');
        
        hands = new window.Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
            }
        });
        
        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        hands.onResults(onHandResults);
        
        camera = new window.Camera(video, {
            onFrame: async () => {
                if (hands && handDetectionActive) {
                    await hands.send({image: video});
                }
            },
            width: video.videoWidth,
            height: video.videoHeight
        });
        
        camera.start();
        handDetectionActive = true;
    } catch (error) {
        console.error('Error initializing hand detection:', error);
    }
}

// Handle hand detection results
function onHandResults(results) {
    if (!canvasCtx) return;
    
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (let hand of results.multiHandLandmarks) {
            drawHand(hand);
            
            // Calculate finger distances and display image
            const fingerDistance = calculateFingerDistance(hand);
            displayImageBasedOnDistance(fingerDistance, canvas.width, canvas.height);
        }
    }
}

// Draw hand skeleton
function drawHand(landmarks) {
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [5, 6], [6, 7], [7, 8],
        [9, 10], [10, 11], [11, 12],
        [13, 14], [14, 15], [15, 16],
        [17, 18], [18, 19], [19, 20],
        [0, 5], [5, 9], [9, 13], [13, 17], [17, 0]
    ];
    
    canvasCtx.fillStyle = '#b0b0b0';
    canvasCtx.strokeStyle = '#808080';
    canvasCtx.lineWidth = 2;
    
    // Draw connections
    for (let connection of connections) {
        const start = landmarks[connection[0]];
        const end = landmarks[connection[1]];
        
        canvasCtx.beginPath();
        canvasCtx.moveTo(start.x * canvas.width, start.y * canvas.height);
        canvasCtx.lineTo(end.x * canvas.width, end.y * canvas.height);
        canvasCtx.stroke();
    }
    
    // Draw landmarks (finger points)
    for (let landmark of landmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 4, 0, 2 * Math.PI);
        canvasCtx.fill();
    }
}

// Calculate distance between thumb and index finger
function calculateFingerDistance(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    
    const dx = (thumbTip.x - indexTip.x) * canvas.width;
    const dy = (thumbTip.y - indexTip.y) * canvas.height;
    
    return Math.sqrt(dx * dx + dy * dy);
}

// Display image based on finger distance
function displayImageBasedOnDistance(distance, width, height) {
    let imageContainer = document.getElementById('finger-image-container');
    
    if (!imageContainer) {
        imageContainer = document.createElement('div');
        imageContainer.id = 'finger-image-container';
        imageContainer.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 10;
            pointer-events: none;
        `;
        document.getElementById('camera-feed-container').appendChild(imageContainer);
    }
    
    // Scale image based on distance (50-200px range)
    const scaledSize = Math.max(50, Math.min(200, distance / 2));
    
    // Create or update image if it doesn't exist
    if (!imageContainer.querySelector('img')) {
        const img = document.createElement('img');
        img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="40" fill="%23888888"/%3E%3Ccircle cx="50" cy="50" r="30" fill="%23a0a0a0"/%3E%3C/svg%3E';
        img.style.cssText = `
            width: ${scaledSize}px;
            height: ${scaledSize}px;
            filter: drop-shadow(0 0 10px rgba(180, 180, 180, 0.6));
            transition: width 0.1s, height 0.1s;
        `;
        imageContainer.appendChild(img);
    } else {
        const img = imageContainer.querySelector('img');
        img.style.width = scaledSize + 'px';
        img.style.height = scaledSize + 'px';
    }
}

// Request camera access
async function requestCameraAccess() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } });
        console.log('Camera access granted');
        const feedContainer = document.getElementById('camera-feed-container');
        feedContainer.style.display = 'block';
        const video = document.getElementById('camera-feed');
        video.srcObject = cameraStream;
        
        // Start hand detection after camera loads
        video.onloadedmetadata = () => {
            setTimeout(() => {
                initializeHandDetection();
            }, 500);
        };
    } catch (error) {
        if (error.name === 'NotAllowedError') {
            alert('Camera access denied. Please enable camera permissions in your browser settings.');
        } else if (error.name === 'NotFoundError') {
            alert('No camera device found.');
        } else {
            alert('Error accessing camera: ' + error.message);
        }
    }
}

// Capture photo from camera (without the hand canvas overlay)
function capturePhoto() {
    const video = document.getElementById('camera-feed');
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Convert canvas to image and download
    captureCanvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `photo_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        alert('Photo captured and downloaded!');
    }, 'image/jpeg', 0.95);
}

// Close camera
function closeCameraModal() {
    const feedContainer = document.getElementById('camera-feed-container');
    feedContainer.style.display = 'none';
    handDetectionActive = false;
    
    if (canvas) {
        canvas.remove();
        canvas = null;
    }
    
    const imageContainer = document.getElementById('finger-image-container');
    if (imageContainer) {
        imageContainer.remove();
    }
    
    if (camera) {
        camera.stop();
        camera = null;
    }
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

// Add click event to camera button when page loads
document.addEventListener('DOMContentLoaded', function() {
    const cameraButton = document.getElementById('camera-button');
    if (cameraButton) {
        cameraButton.addEventListener('click', requestCameraAccess);
    }
});
