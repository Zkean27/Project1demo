const video = document.getElementById("camera");

// RAW canvas (visible)
const canvas = document.getElementById("metaphysicalCanvas");
const ctx = canvas.getContext("2d");

// TRAIL canvas (soft ghost trails)
const trailCanvas = document.createElement("canvas");
const trailCtx = trailCanvas.getContext("2d");

// COLOUR TRAIL canvas (hue-shifting ribbons)
const colorCanvas = document.createElement("canvas");
const colorCtx = colorCanvas.getContext("2d");

let lastFrame = null;

let isFrozen = false;
let fadeProgress = 0;
let fadingIn = false;

// Movement thresholds (Option B: medium sensitivity)
const lowThreshold = 20;   // ignore breathing + noise
const highThreshold = 45;  // strong movement → colour ribbons

// Hue cycle speed: full rotation every 6 seconds
let hue = 0;
const hueSpeed = 360 / (60 * 6); // 360 degrees / (60fps * 6 seconds)

// Warm tint (Option 2)
const warmTint = "rgba(255, 140, 80, 1)";


navigator.mediaDevices.getUserMedia({
    video: {
        facingMode: { ideal: "environment" }
    }
})
    .then(stream => {
        video.srcObject = stream;

        video.addEventListener("loadedmetadata", () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            trailCanvas.width = video.videoWidth;
            trailCanvas.height = video.videoHeight;

            colorCanvas.width = video.videoWidth;
            colorCanvas.height = video.videoHeight;

            draw();
        });
    })
    .catch(err => console.error("Camera error:", err));


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
            // DILATE THE MOVEMENT MASK (thicken trails)
            const dilated = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
            const d = dilated.data;

            for (let y = 1; y < canvas.height - 1; y++) {
                for (let x = 1; x < canvas.width - 1; x++) {
                    const i = (y * canvas.width + x) * 4;

                    // If this pixel is movement
                    if (d[i + 3] > 0) {
                        // Spread movement to neighbors
                        const neighbors = [
                            i - 4,               // left
                            i + 4,               // right
                            i - canvas.width * 4,  // up
                            i + canvas.width * 4   // down
                        ];

                        for (const n of neighbors) {
                            d[n + 3] = 255; // make neighbor opaque
                        }
                    }
                }
            }

            maskCtx.putImageData(dilated, 0, 0);


            // STEP 4 — Soft ghost trails (medium movement)
            trailCtx.globalCompositeOperation = "source-over";
            trailCtx.globalAlpha = 0.03 * fadeProgress; // slightly reduced
            trailCtx.drawImage(maskCanvas, 0, 0);

            // STEP 5 — Colour ribbons (strong movement)
            hue += hueSpeed;
            if (hue >= 360) hue -= 360;

            // Tint mask with warm colour
            colorCtx.globalCompositeOperation = "source-over";
            colorCtx.globalAlpha = 0.10 * fadeProgress; // slightly increased

            colorCtx.fillStyle = warmTint;
            colorCtx.fillRect(0, 0, colorCanvas.width, colorCanvas.height);

            // Apply movement mask
            colorCtx.globalCompositeOperation = "overlay";
            colorCtx.globalAlpha = 0.8;
            colorCtx.drawImage(maskCanvas, 0, 0);

           

            // Apply hue rotation
            colorCtx.globalCompositeOperation = "source-over";
            colorCtx.filter = `hue-rotate(${hue}deg)`;
            colorCtx.drawImage(colorCanvas, 0, 0);
            colorCtx.filter = "none";
        }

        // STEP 6 — Blend ghost trails
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 1;
        ctx.drawImage(trailCanvas, 0, 0);

        // STEP 7 — Blend colour ribbons (gentle but visible)
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 1;
        ctx.drawImage(colorCanvas, 0, 0);

        ctx.globalCompositeOperation = "source-over";

        lastFrame = currentFrame;
    }

    requestAnimationFrame(draw);
}
