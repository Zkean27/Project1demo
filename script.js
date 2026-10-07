const video = document.getElementById("camera");

// MAIN metaphysical canvas (visible)
const canvas = document.getElementById("metaphysicalCanvas");
const ctx = canvas.getContext("2d");

// TRAIL canvas (ghost trails)
const trailCanvas = document.createElement("canvas");
const trailCtx = trailCanvas.getContext("2d");

// COLOUR TRAIL canvas (hue-shifting ribbons)
const colorCanvas = document.createElement("canvas");
const colorCtx = colorCanvas.getContext("2d");

let lastFrame = null;
let isFrozen = false;
let fadeProgress = 0;
let fadingIn = false;

// Movement thresholds
const lowThreshold = 20;
const highThreshold = 45;

// Hue cycle speed
let hue = 0;
const hueSpeed = 360 / (60 * 6);

// Warm tint
const warmTint = "rgba(255, 140, 80, 1)";


// ⭐ FULLSCREEN CANVAS RESIZE FUNCTION
function resizeAll() {
    const w = window.innerWidth;
    const h = window.innerHeight - 100; // leave room for buttons

    canvas.width = w;
    canvas.height = h;

    trailCanvas.width = w;
    trailCanvas.height = h;

    colorCanvas.width = w;
    colorCanvas.height = h;
}

window.addEventListener("resize", resizeAll);


// ⭐ CAMERA SETUP
navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" } }
})
    .then(stream => {
        video.srcObject = stream;

        video.addEventListener("loadedmetadata", () => {
            resizeAll();
            draw();
        });
    })
    .catch(err => console.error("Camera error:", err));


// ⭐ BUTTONS
document.getElementById("beginButton").addEventListener("click", () => {
    if (fadingIn || isFrozen) return;

    fadeProgress = 0;
    fadingIn = true;

    let fadeInterval = setInterval(() => {
        fadeProgress += 0.01;

        if (fadeProgress >= 1) {
            fadeProgress = 1;
            fadingIn = false;
            clearInterval(fadeInterval);

            setTimeout(() => {
                isFrozen = true;
            }, 5000);
        }
    }, 100);
});

document.getElementById("resetButton").addEventListener("click", () => {
    isFrozen = false;
    fadingIn = false;
    fadeProgress = 0;

    trailCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
    colorCtx.clearRect(0, 0, colorCanvas.width, colorCanvas.height);

    lastFrame = null;
});


// ⭐ MAIN DRAW LOOP
function draw() {
    if (!isFrozen) {

        // STEP 1 — Draw raw camera
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // STEP 2 — Capture current frame
        const buffer = document.createElement("canvas");
        buffer.width = canvas.width;
        buffer.height = canvas.height;
        const bctx = buffer.getContext("2d");
        bctx.drawImage(video, 0, 0);
        const currentFrame = bctx.getImageData(0, 0, canvas.width, canvas.height);

        if (lastFrame && fadeProgress > 0) {

            const curr = currentFrame.data;
            const last = lastFrame.data;

            // Movement mask canvas
            const maskCanvas = document.createElement("canvas");
            maskCanvas.width = canvas.width;
            maskCanvas.height = canvas.height;
            const maskCtx = maskCanvas.getContext("2d");
            const maskData = maskCtx.createImageData(canvas.width, canvas.height);
            const mask = maskData.data;

            // STEP 3 — Build movement mask
            for (let i = 0; i < curr.length; i += 4) {
                const diff =
                    Math.abs(curr[i] - last[i]) +
                    Math.abs(curr[i + 1] - last[i + 1]) +
                    Math.abs(curr[i + 2] - last[i + 2]);

                if (diff > lowThreshold) {
                    mask[i] = curr[i];
                    mask[i + 1] = curr[i + 1];
                    mask[i + 2] = curr[i + 2];
                    mask[i + 3] = 255;
                }
            }

            maskCtx.putImageData(maskData, 0, 0);

            // DILATE MOVEMENT MASK
            const dilated = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
            const d = dilated.data;

            for (let y = 1; y < canvas.height - 1; y++) {
                for (let x = 1; x < canvas.width - 1; x++) {
                    const i = (y * canvas.width + x) * 4;

                    if (d[i + 3] > 0) {
                        const neighbors = [
                            i - 4,
                            i + 4,
                            i - canvas.width * 4,
                            i + canvas.width * 4
                        ];
                        for (const n of neighbors) {
                            d[n + 3] = 255;
                        }
                    }
                }
            }

            maskCtx.putImageData(dilated, 0, 0);


            // STEP 4 — Soft ghost trails
            trailCtx.globalCompositeOperation = "source-over";
            trailCtx.globalAlpha = 0.03 * fadeProgress;
            trailCtx.drawImage(maskCanvas, 0, 0);

            // STEP 5 — Colour ribbons
            hue += hueSpeed;
            if (hue >= 360) hue -= 360;

            colorCtx.globalCompositeOperation = "source-over";
            colorCtx.globalAlpha = 0.10 * fadeProgress;

            colorCtx.fillStyle = warmTint;
            colorCtx.fillRect(0, 0, colorCanvas.width, colorCanvas.height);

            colorCtx.globalCompositeOperation = "overlay";
            colorCtx.globalAlpha = 0.8;
            colorCtx.drawImage(maskCanvas, 0, 0);

            colorCtx.globalCompositeOperation = "source-over";
            colorCtx.filter = `hue-rotate(${hue}deg)`;
            colorCtx.drawImage(colorCanvas, 0, 0);
            colorCtx.filter = "none";
        }

        // STEP 6 — Blend ghost trails
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 1;
        ctx.drawImage(trailCanvas, 0, 0);

        // STEP 7 — Blend colour ribbons
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 1;
        ctx.drawImage(colorCanvas, 0, 0);

        ctx.globalCompositeOperation = "source-over";

        lastFrame = currentFrame;
    }

    requestAnimationFrame(draw);
}

