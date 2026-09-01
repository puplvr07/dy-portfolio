// Camera Access for About Me Section with Hand Tracking
let cameraStream = null;
let handDetectionActive = false;
let canvas = null;
let canvasCtx = null;
let camera = null;
let hands = null;
let certImage = null;

// Preload cert1 image
function loadCertImage() {
    return new Promise((resolve) => {
        certImage = new Image();
        certImage.crossOrigin = 'anonymous';
        certImage.src = 'assets/Me.jpg';
        certImage.onload = resolve;
        certImage.onerror = () => {
            console.warn('Could not load cert1.jpg, will use fallback');
            resolve();
        };
    });
}

// Load MediaPipe Hands
function loadMediaPipe() {
    return Promise.all([
        new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
            script.onload = () => {
                console.log('camera_utils loaded');
                resolve();
            };
            script.onerror = () => {
                console.error('Failed to load camera_utils');
                reject(new Error('Failed to load camera_utils'));
            };
            document.head.appendChild(script);
        }),
        new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';
            script.onload = () => {
                console.log('drawing_utils loaded');
                resolve();
            };
            script.onerror = () => {
                console.error('Failed to load drawing_utils');
                reject(new Error('Failed to load drawing_utils'));
            };
            document.head.appendChild(script);
        }),
        new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
            script.onload = () => {
                console.log('hands.js loaded');
                resolve();
            };
            script.onerror = () => {
                console.error('Failed to load hands.js');
                reject(new Error('Failed to load hands.js - check browser console for CORS/CSP errors'));
            };
            document.head.appendChild(script);
        }),
        new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/delaunator@5.3.0/+esm';
            script.type = 'module';
            script.onload = () => {
                console.log('delaunator loaded');
                resolve();
            };
            script.onerror = () => {
                console.warn('Delaunator failed to load, will use fallback triangulation');
                resolve();
            };
            document.head.appendChild(script);
        })
    ]);
}

// Initialize hand detection
async function initializeHandDetection() {
    try {
        await loadMediaPipe();
        await loadCertImage();
        
        const video = document.getElementById('camera-feed');
        const feedContainer = document.getElementById('camera-feed-container');
        
        // Ensure container is visible
        if (feedContainer.style.display === 'none') {
            feedContainer.style.display = 'block';
        }
        
        console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
        
        // Wait for video to have proper dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            console.log('Video dimensions not ready, retrying...');
            setTimeout(initializeHandDetection, 200);
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
            feedContainer.style.position = 'relative';
            feedContainer.appendChild(canvas);
            console.log('Canvas created');
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvasCtx = canvas.getContext('2d');
        console.log('Canvas dimensions set to:', canvas.width, 'x', canvas.height);
        
        hands = new window.Hands({
            locateFile: (file) => {
                const url = `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                console.log('Loading MediaPipe resource:', url);
                return url;
            }
        });
        
        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        hands.onResults(onHandResults);
        console.log('Hands model initialized');
        
        camera = new window.Camera(video, {
            onFrame: async () => {
                if (hands && handDetectionActive) {
                    try {
                        await hands.send({image: video});
                    } catch (err) {
                        console.error('Error in hand detection frame:', err);
                    }
                }
            },
            width: video.videoWidth,
            height: video.videoHeight
        });
        
        camera.start();
        handDetectionActive = true;
        console.log('Hand tracking started');
    } catch (error) {
        console.error('Error initializing hand detection:', error);
        alert('Error initializing hand tracking. Check browser console for details.');
    }
}

// Handle hand detection results
function onHandResults(results) {
    if (!canvasCtx) return;
    
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        for (let hand of results.multiHandLandmarks) {
            // Draw hand skeleton
            drawHand(hand);
            
            // Draw cert image through finger shape
            drawImageThroughFingerShape(hand);
        }
    }
}

// Simple Delaunay triangulation implementation for hand mesh
function simpleHandTriangulation(landmarks) {
    // Create triangles connecting all fingers through their joints
    const triangles = [];
    
    // Convert landmarks to 2D array for easier access
    const points = landmarks.map(l => [l.x * canvas.width, l.y * canvas.height]);
    
    // Define triangle faces connecting the palm to all fingers
    // Palm connections (wrist and finger bases)
    const palmTriangles = [
        [0, 1, 5],   // wrist to thumb-index
        [0, 5, 9],   // wrist to index-middle
        [0, 9, 13],  // wrist to middle-ring
        [0, 13, 17], // wrist to ring-pinky
        [0, 17, 1]   // wrist back to thumb
    ];
    
    // Finger joint triangles for each finger
    // Thumb
    triangles.push([1, 2, 3], [1, 3, 4], [2, 3, 4]);
    // Index
    triangles.push([5, 6, 7], [5, 7, 8], [6, 7, 8]);
    // Middle
    triangles.push([9, 10, 11], [9, 11, 12], [10, 11, 12]);
    // Ring
    triangles.push([13, 14, 15], [13, 15, 16], [14, 15, 16]);
    // Pinky
    triangles.push([17, 18, 19], [17, 19, 20], [18, 19, 20]);
    
    // Add palm triangles
    triangles.push(...palmTriangles);
    
    // Inter-finger web triangles
    triangles.push([5, 8, 9], [8, 9, 10]); // index-middle
    triangles.push([9, 12, 13], [12, 13, 14]); // middle-ring
    triangles.push([13, 16, 17], [16, 17, 18]); // ring-pinky
    
    return triangles.map(tri => tri.map(idx => points[idx]));
}

// Draw cert image clipped to finger shape using triangulation
function drawImageThroughFingerShape(landmarks) {
    if (!certImage || !certImage.src) return;
    
    // Get triangles for hand mesh
    const triangles = simpleHandTriangulation(landmarks);
    
    // Draw image through each triangle
    const imageAspect = certImage.width / certImage.height;
    const canvasAspect = canvas.width / canvas.height;
    
    let scaledWidth, scaledHeight;
    if (imageAspect > canvasAspect) {
        scaledHeight = canvas.height;
        scaledWidth = scaledHeight * imageAspect;
    } else {
        scaledWidth = canvas.width;
        scaledHeight = scaledWidth / imageAspect;
    }
    
    const imgX = (canvas.width - scaledWidth) / 2;
    const imgY = (canvas.height - scaledHeight) / 2;
    
    // Draw each triangle
    for (let triangle of triangles) {
        canvasCtx.save();
        canvasCtx.beginPath();
        canvasCtx.moveTo(triangle[0][0], triangle[0][1]);
        canvasCtx.lineTo(triangle[1][0], triangle[1][1]);
        canvasCtx.lineTo(triangle[2][0], triangle[2][1]);
        canvasCtx.closePath();
        canvasCtx.clip();
        
        // Draw the full image for each triangle (it will only show the clipped portion)
        canvasCtx.drawImage(certImage, imgX, imgY, scaledWidth, scaledHeight);
        
        canvasCtx.restore();
    }
    
    // Draw hand outline for visual reference
    canvasCtx.strokeStyle = '#c0c0c0';
    canvasCtx.lineWidth = 2;
    for (let triangle of triangles) {
        canvasCtx.beginPath();
        canvasCtx.moveTo(triangle[0][0], triangle[0][1]);
        canvasCtx.lineTo(triangle[1][0], triangle[1][1]);
        canvasCtx.lineTo(triangle[2][0], triangle[2][1]);
        canvasCtx.closePath();
        canvasCtx.stroke();
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

// Request camera access
async function requestCameraAccess() {
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } });
        console.log('Camera access granted');
        const feedContainer = document.getElementById('camera-feed-container');
        feedContainer.style.display = 'block';
        const video = document.getElementById('camera-feed');
        video.srcObject = cameraStream;
        
        // Explicitly play the video
        video.play().then(() => {
            console.log('Video playing');
        }).catch(err => {
            console.error('Error playing video:', err);
        });
        
        // Start hand detection after video is ready and has dimensions
        video.onloadedmetadata = () => {
            console.log('Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
            // Ensure container is visible and video has real dimensions
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                setTimeout(() => {
                    initializeHandDetection();
                }, 500);
            }
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
