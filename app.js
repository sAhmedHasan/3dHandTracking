// Get webcam video element
const video = document.getElementById('video');

// Load MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

// Create a MediaPipe Camera instance
const camera = new Camera(video, {
    onFrame: async () => {
        await hands.send({ image: video });
    },
    width: 1920/2,
    height: 1080/2
});

camera.start();

// Initialize Three.js Scene
const scene = new THREE.Scene();
const camera3D = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

camera3D.position.z = 2.5;

// **Lighting Setup (No Shadows)**
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(2, 5, 5);
scene.add(directionalLight);


const whiteMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Pure white color
    roughness: 0.3, // Slightly smooth surface
    metalness: 0.1 // A little reflectivity for realism
});

// **Add a 3D model to the scene with new material**
const modelGeometry = new THREE.DodecahedronGeometry(0.5);
const model = new THREE.Mesh(modelGeometry, whiteMaterial);
scene.add(model);



// **Create Finger Tracking Spheres**
const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);

const thumbSphereL = new THREE.Mesh(sphereGeometry, sphereMaterial);
const indexSphereL = new THREE.Mesh(sphereGeometry, sphereMaterial);
const thumbSphereR = new THREE.Mesh(sphereGeometry, sphereMaterial);
const indexSphereR = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(thumbSphereL, indexSphereL, thumbSphereR, indexSphereR);

// **Create Lines**
const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
const lineGeometryL = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const lineGeometryR = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const lineL = new THREE.Line(lineGeometryL, lineMaterial);
const lineR = new THREE.Line(lineGeometryR, lineMaterial);
scene.add(lineL, lineR);




// Create 2D text labels
const textExpand = document.createElement("div");
textExpand.style.position = "absolute";
textExpand.style.color = "white";
textExpand.style.fontSize = "18px";
textExpand.style.fontFamily = "Inter";
textExpand.innerHTML = "expand";
document.body.appendChild(textExpand);

const textRotate = document.createElement("div");
textRotate.style.position = "absolute";
textRotate.style.color = "white";
textRotate.style.fontSize = "18px";
textRotate.style.fontFamily = "Inter";
textRotate.innerHTML = "rotate";
document.body.appendChild(textRotate);

// Convert MediaPipe normalized coordinates to 3.js
function convertTo3D(landmark) {
    return new THREE.Vector3(
        (landmark.x - 0.5) * 3.5,
        -(landmark.y - 0.5) * 3.5,
        -landmark.z * 3.5
    );
}

// Convert 3D World Coordinates to 2D screen space
function convertToScreenPosition(position) {
    const vector = position.clone().project(camera3D);
    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
    return { x, y };
}

// **Smooth Movement Functions**
function smoothMoveSphere(sphere, targetPos, smoothingFactor = 0.2) {
    sphere.position.lerp(targetPos, smoothingFactor);
}
function smoothMoveLine(line, start, end, smoothingFactor = 0.2) {
    const positions = line.geometry.attributes.position.array;
    positions[0] = THREE.MathUtils.lerp(positions[0], start.x, smoothingFactor);
    positions[1] = THREE.MathUtils.lerp(positions[1], start.y, smoothingFactor);
    positions[2] = THREE.MathUtils.lerp(positions[2], start.z, smoothingFactor);
    positions[3] = THREE.MathUtils.lerp(positions[3], end.x, smoothingFactor);
    positions[4] = THREE.MathUtils.lerp(positions[4], end.y, smoothingFactor);
    positions[5] = THREE.MathUtils.lerp(positions[5], end.z, smoothingFactor);
    line.geometry.attributes.position.needsUpdate = true;
}

// **Update Text Labels**
function updateTextPosition(textElement, position) {
    const screenPos = convertToScreenPosition(position);
    textElement.style.left = `${screenPos.x}px`;
    textElement.style.top = `${screenPos.y - 120}px`; // Slightly above line
}

// **Process Hand Tracking Data**
hands.onResults(results => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        let leftHand = null;
        let rightHand = null;

        results.multiHandedness.forEach((hand, index) => {
            if (hand.label === "Left") {
                leftHand = results.multiHandLandmarks[index];
            } else {
                rightHand = results.multiHandLandmarks[index];
            }
        });

        // **LEFT HAND: Controls Scaling**
        if (leftHand) {
            const leftThumbTip = convertTo3D(leftHand[4]);
            const leftIndexTip = convertTo3D(leftHand[8]);
            const distance = leftThumbTip.distanceTo(leftIndexTip);

            model.scale.lerp(new THREE.Vector3(0.3 + distance * 1.5, 0.3 + distance * 1.5, 0.3 + distance * 1.5), 0.05);

            smoothMoveSphere(thumbSphereL, leftThumbTip);
            smoothMoveSphere(indexSphereL, leftIndexTip);
            smoothMoveLine(lineL, leftThumbTip, leftIndexTip);

            // **Move "Expand" Text Above Line**
            const midPoint = new THREE.Vector3().lerpVectors(leftThumbTip, leftIndexTip, 0.5);
            updateTextPosition(textExpand, midPoint);
        }

        // **RIGHT HAND: Controls Rotation**
        if (rightHand) {
            const rightThumbTip = convertTo3D(rightHand[4]);
            const rightIndexTip = convertTo3D(rightHand[8]);

            const dx = rightThumbTip.x - rightIndexTip.x;
            const dy = rightThumbTip.y - rightIndexTip.y;

            model.rotation.x = THREE.MathUtils.lerp(model.rotation.x, dy * Math.PI * 5, 0.1);
            model.rotation.y = THREE.MathUtils.lerp(model.rotation.y, dx * Math.PI * 5, 0.1);

            smoothMoveSphere(thumbSphereR, rightThumbTip);
            smoothMoveSphere(indexSphereR, rightIndexTip);
            smoothMoveLine(lineR, rightThumbTip, rightIndexTip);

            // **Move "Rotate" Text Above Line**
            const midPoint = new THREE.Vector3().lerpVectors(rightThumbTip, rightIndexTip, 0.5);
            updateTextPosition(textRotate, midPoint);
        }
    }
});

// **Animation Loop**
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera3D);
}
animate();
