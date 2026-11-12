const video = document.getElementById("camera-view");

const displayCanvas =
    document.getElementById("display-canvas");

const displayCtx =
    displayCanvas.getContext("2d");

const captureCanvas =
    document.getElementById("capture-canvas");

const captureCtx =
    captureCanvas.getContext("2d");

const captureBtn =
    document.getElementById("capture-btn");

const resetBtn =
    document.getElementById("reset-btn");

const countdownDisplay =
    document.getElementById("countdown");

const controlsToggle =
    document.getElementById("controls-toggle");

const controlsContent =
    document.getElementById("controls-content");

let stream = null;

let countdownValue = 10;

let countdownInterval = null;

let captureInterval = null;

let previousFrame = null;

/*
====================
CONTROLS
====================
*/

controlsToggle.addEventListener("click", () => {

    if (controlsContent.style.display === "block") {

        controlsContent.style.display = "none";

    } else {

        controlsContent.style.display = "block";

    }

});

/*
====================
CAMERA
====================
*/

async function startCamera() {

    try {

        stream = await navigator.mediaDevices.getUserMedia({

            video: {
                facingMode: {
                    ideal: "environment"
                }
            },

            audio: false

        });

    }
    catch {

        stream = await navigator.mediaDevices.getUserMedia({

            video: true,
            audio: false

        });

    }

    video.srcObject = stream;

}

/*
====================
MOTION ACCUMULATION
====================
*/

function accumulateMotion() {

    if (
        video.videoWidth === 0 ||
        video.videoHeight === 0
    ) {
        return;
    }

    captureCanvas.width =
        video.videoWidth;

    captureCanvas.height =
        video.videoHeight;

    displayCanvas.width =
        video.videoWidth;

    displayCanvas.height =
        video.videoHeight;

    captureCtx.drawImage(
        video,
        0,
        0,
        captureCanvas.width,
        captureCanvas.height
    );

    const currentFrame =
        captureCtx.getImageData(
            0,
            0,
            captureCanvas.width,
            captureCanvas.height
        );

    if (!previousFrame) {

        previousFrame = currentFrame;
        return;

    }

    const current =
        currentFrame.data;

    const previous =
        previousFrame.data;

    const motionFrame =
        displayCtx.createImageData(
            currentFrame
        );

    const motion =
        motionFrame.data;

    for (
        let i = 0;
        i < current.length;
        i += 4
    ) {

        const difference =
            Math.abs(current[i] - previous[i]) +
            Math.abs(current[i + 1] - previous[i + 1]) +
            Math.abs(current[i + 2] - previous[i + 2]);

        if (difference > 40) {

            motion[i] = current[i];
            motion[i + 1] = current[i + 1];
            motion[i + 2] = current[i + 2];
            motion[i + 3] = 255;

        }

    }

    /*
    Accumulate onto display canvas
    */

    displayCtx.putImageData(
        motionFrame,
        0,
        0
    );

    previousFrame = currentFrame;

}

/*
====================
SHOW RESULT
====================
*/

function showResult() {

    /*
    Draw final body position
    */

    displayCtx.globalAlpha = 1;

    displayCtx.drawImage(
        video,
        0,
        0,
        displayCanvas.width,
        displayCanvas.height
    );

    video.style.display =
        "none";

    displayCanvas.style.display =
        "block";

}

/*
====================
CAPTURE
====================
*/

captureBtn.addEventListener("click", () => {

    if (countdownInterval) return;

    previousFrame = null;

    displayCtx.clearRect(
        0,
        0,
        displayCanvas.width,
        displayCanvas.height
    );

    countdownValue = 10;

    countdownDisplay.textContent =
        countdownValue;

    captureBtn.disabled = true;

    captureInterval =
        setInterval(
            accumulateMotion,
            100
        );

    countdownInterval =
        setInterval(() => {

            countdownValue--;

            countdownDisplay.textContent =
                countdownValue;

            if (countdownValue <= 0) {

                clearInterval(
                    countdownInterval
                );

                clearInterval(
                    captureInterval
                );

                countdownInterval = null;
                captureInterval = null;

                showResult();

                captureBtn.disabled =
                    false;

            }

        }, 1000);

});

/*
====================
RESET
====================
*/

resetBtn.addEventListener("click", () => {

    clearInterval(
        countdownInterval
    );

    clearInterval(
        captureInterval
    );

    countdownInterval = null;
    captureInterval = null;

    previousFrame = null;

    countdownValue = 10;

    countdownDisplay.textContent =
        "10";

    displayCtx.clearRect(
        0,
        0,
        displayCanvas.width,
        displayCanvas.height
    );

    video.style.display =
        "block";

    displayCanvas.style.display =
        "none";

    captureBtn.disabled =
        false;

});

/*
====================
START APP
====================
*/

startCamera();