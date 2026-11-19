const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const wordCanvas = document.getElementById("word-canvas");
const wordCtx = wordCanvas.getContext("2d");

const resultSpan = document.getElementById("result");
const confidenceSpan = document.getElementById("confidence");
const confidenceBar = document.getElementById("confidence-bar");
const confidenceText = document.getElementById("confidence-text");
const wordBreakdownEl = document.getElementById("word-breakdown");
const interpretationText = document.getElementById("interpretation-text");

const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const historyLog = document.getElementById("history-log");
const reversalRateSpan = document.getElementById("reversal-rate");
const riskBanner = document.getElementById("risk-banner");
const charPills = document.querySelectorAll(".char-pill");

const strokeCountEl = document.getElementById("stroke-count");
const drawTimeEl = document.getElementById("draw-time");
const activeTargetEl = document.getElementById("active-target-display");
const sessionDateEl = document.getElementById("session-date");

if (sessionDateEl) {
    sessionDateEl.value = new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

let history = [];
let totalValidCount = 0;
let totalReversalCount = 0;
let selectedChar = null;

let strokeCount = 0;
let firstStrokeTime = null;
let lastStrokeTime = null;

if (sessionStorage.getItem("loggedIn") === "true") {
    loginView.style.display = "none";
    dashboardView.style.display = "block";
}

// Sign In / Sign Up Authentication Logic (No Default Account)
let authMode = "signin"; // "signin" | "signup"

const tabSignin = document.getElementById("tab-signin");
const tabSignup = document.getElementById("tab-signup");
const authTitle = document.getElementById("auth-title");
const confirmPassGroup = document.getElementById("confirm-pass-group");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const loginSuccess = document.getElementById("login-success");

function switchAuthMode(newMode) {
    authMode = newMode;
    loginError.style.display = "none";
    loginSuccess.style.display = "none";

    if (authMode === "signin") {
        tabSignin.classList.add("active");
        tabSignup.classList.remove("active");
        authTitle.innerText = "NeuroScript Sign In";
        confirmPassGroup.style.display = "none";
        loginBtn.innerText = "Sign In to Dashboard";
    } else {
        tabSignup.classList.add("active");
        tabSignin.classList.remove("active");
        authTitle.innerText = "Create Evaluator Account";
        confirmPassGroup.style.display = "block";
        loginBtn.innerText = "Register Account";
    }
}

tabSignin.addEventListener("click", () => switchAuthMode("signin"));
tabSignup.addEventListener("click", () => switchAuthMode("signup"));

loginBtn.addEventListener("click", () => {
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value.trim();
    const confirmPass = document.getElementById("confirm-password").value.trim();
    const regex = /^[a-zA-Z0-9]+$/;

    loginError.style.display = "none";
    loginSuccess.style.display = "none";

    if (!user || !pass) {
        loginError.innerText = "Please enter both an ID and a passcode.";
        loginError.style.display = "block";
        return;
    }

    if (!regex.test(user) || !regex.test(pass)) {
        loginError.innerText = "Only letters and numbers are allowed.";
        loginError.style.display = "block";
        return;
    }

    const users = JSON.parse(localStorage.getItem("neuroscript_users") || "{}");

    if (authMode === "signup") {
        if (pass !== confirmPass) {
            loginError.innerText = "Passcodes do not match.";
            loginError.style.display = "block";
            return;
        }
        if (users[user]) {
            loginError.innerText = "This ID is already registered. Please sign in.";
            loginError.style.display = "block";
            return;
        }
        users[user] = pass;
        localStorage.setItem("neuroscript_users", JSON.stringify(users));

        switchAuthMode("signin");
        loginSuccess.innerText = `Account '${user}' registered! Sign in to continue.`;
        loginSuccess.style.display = "block";
        document.getElementById("password").value = "";
        document.getElementById("confirm-password").value = "";
        return;
    }

    if (users[user] && users[user] === pass) {
        sessionStorage.setItem("loggedIn", "true");
        sessionStorage.setItem("currentUser", user);
        loginView.style.display = "none";
        dashboardView.style.display = "block";
    } else {
        loginError.innerText = "Account not found or wrong passcode. Please create an account first.";
        loginError.style.display = "block";
    }
});

document.getElementById("logout-btn").addEventListener("click", () => {
    sessionStorage.removeItem("loggedIn");
    location.reload();
});

document.getElementById("print-report-btn").addEventListener("click", () => {
    window.print();
});

charPills.forEach((pill) => {
    pill.addEventListener("click", () => {
        const isAlreadySelected = pill.classList.contains("selected");
        charPills.forEach((p) => p.classList.remove("selected"));
        if (isAlreadySelected) {
            selectedChar = null;
            activeTargetEl.innerText = "Auto";
        } else {
            pill.classList.add("selected");
            selectedChar = pill.dataset.char;
            activeTargetEl.innerText = `'${selectedChar}'`;
        }
    });
});

document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.getElementById("target-word-input").value = btn.dataset.word;
    });
});

let isDrawing = false;
let mode = "draw"; // "draw" | "word" | "upload"

function resetAllCanvases() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "black";

    wordCtx.fillStyle = "white";
    wordCtx.fillRect(0, 0, wordCanvas.width, wordCanvas.height);
    wordCtx.lineWidth = 9;
    wordCtx.lineCap = "round";
    wordCtx.lineJoin = "round";
    wordCtx.strokeStyle = "black";

    strokeCount = 0;
    firstStrokeTime = null;
    lastStrokeTime = null;
    strokeCountEl.innerText = "0";
    drawTimeEl.innerText = "0.0s";
}

resetAllCanvases();

function switchMode(newMode) {
    mode = newMode;
    document.getElementById("mode-draw").classList.toggle("active", mode === "draw");
    document.getElementById("mode-word").classList.toggle("active", mode === "word");
    document.getElementById("mode-upload").classList.toggle("active", mode === "upload");

    document.getElementById("single-char-controls").style.display = mode === "word" ? "none" : "block";
    document.getElementById("word-controls").style.display = mode === "word" ? "block" : "none";

    canvas.style.display = mode === "draw" ? "block" : "none";
    wordCanvas.style.display = mode === "word" ? "block" : "none";
    document.getElementById("preview-image").style.display = mode === "upload" ? "block" : "none";

    if (mode === "word") {
        activeTargetEl.innerText = "Word Slice";
    } else {
        activeTargetEl.innerText = selectedChar ? `'${selectedChar}'` : "Auto";
    }
}

document.getElementById("mode-draw").addEventListener("click", () => switchMode("draw"));
document.getElementById("mode-word").addEventListener("click", () => switchMode("word"));
document.getElementById("mode-upload").addEventListener("click", () => {
    switchMode("upload");
    document.getElementById("image-upload").click();
});

document.getElementById("image-upload").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const preview = document.getElementById("preview-image");
            preview.src = event.target.result;
            preview.style.display = "block";
            canvas.style.display = "none";
            wordCanvas.style.display = "none";
        };
        reader.readAsDataURL(file);
    }
});

function bindPadEvents(targetCanvas, targetCtx) {
    function getCoords(e) {
        const rect = targetCanvas.getBoundingClientRect();
        const scaleX = targetCanvas.width / rect.width;
        const scaleY = targetCanvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function start(e) {
        isDrawing = true;
        strokeCount += 1;
        strokeCountEl.innerText = strokeCount;
        if (!firstStrokeTime) firstStrokeTime = performance.now();
        const { x, y } = getCoords(e);
        targetCtx.beginPath();
        targetCtx.moveTo(x, y);
    }

    function move(e) {
        if (!isDrawing) return;
        e.preventDefault();
        const { x, y } = getCoords(e);
        targetCtx.lineTo(x, y);
        targetCtx.stroke();
        lastStrokeTime = performance.now();
        if (firstStrokeTime) {
            drawTimeEl.innerText = `${((lastStrokeTime - firstStrokeTime) / 1000).toFixed(1)}s`;
        }
    }

    function end() {
        isDrawing = false;
        targetCtx.beginPath();
    }

    targetCanvas.addEventListener("mousedown", start);
    targetCanvas.addEventListener("mousemove", move);
    targetCanvas.addEventListener("mouseup", end);
    targetCanvas.addEventListener("mouseout", end);
    targetCanvas.addEventListener("touchstart", start);
    targetCanvas.addEventListener("touchmove", move);
    targetCanvas.addEventListener("touchend", end);
}

bindPadEvents(canvas, ctx);
bindPadEvents(wordCanvas, wordCtx);

document.getElementById("clear-btn").addEventListener("click", () => {
    resetAllCanvases();
    document.getElementById("image-upload").value = "";
    resultSpan.innerText = "Waiting...";
    confidenceText.style.display = "none";
    wordBreakdownEl.style.display = "none";
    wordBreakdownEl.innerHTML = "";
    interpretationText.style.display = "none";
    interpretationText.innerText = "";
    if (mode === "upload") {
        switchMode("draw");
    }
});

document.getElementById("predict-btn").addEventListener("click", () => {
    if (mode === "draw") {
        canvas.toBlob((blob) => { sendSingleImage(blob); }, "image/png");
    } else if (mode === "word") {
        wordCanvas.toBlob((blob) => { sendWordImage(blob); }, "image/png");
    } else {
        const fileInput = document.getElementById("image-upload");
        if (fileInput.files && fileInput.files[0]) {
            sendSingleImage(fileInput.files[0]);
        } else {
            alert("Please upload an image first");
        }
    }
});

function updateChecklistStatus(char, prediction) {
    if (!char || (prediction !== "Normal" && prediction !== "Reversal")) return;
    const pill = document.querySelector(`.char-pill[data-char="${char}"]`);
    if (!pill) return;

    pill.classList.remove("status-normal", "status-reversal");
    const statusSpan = pill.querySelector(".char-status");
    if (prediction === "Normal") {
        pill.classList.add("status-normal");
        statusSpan.textContent = "✓";
    } else {
        pill.classList.add("status-reversal");
        statusSpan.textContent = "⚑";
    }
}

function getInterpretation(prediction, customError = null) {
    if (prediction === "Normal") {
        return "Standard character orientation detected. Stroke geometry aligns with expected letter formation.";
    }
    if (prediction === "Reversal") {
        return "Mirror/orientation reversal detected. Consistent reversals across multiple characters may warrant further educational evaluation.";
    }
    return customError || "Please draw or upload a single, clear character inside the pad.";
}

async function sendSingleImage(blob) {
    const formData = new FormData();
    formData.append("file", blob, "letter.png");
    formData.append("mode", mode);
    if (selectedChar) {
        formData.append("target_char", selectedChar);
    }

    resultSpan.innerText = "Analyzing...";
    confidenceText.style.display = "none";
    wordBreakdownEl.style.display = "none";
    interpretationText.style.display = "none";

    try {
        const response = await fetch("/predict", { method: "POST", body: formData });
        const data = await response.json();

        if (!response.ok || data.error) {
            const prediction = "Invalid input";
            resultSpan.innerHTML = `<span class="badge invalid">${prediction}</span>`;
            interpretationText.innerText = getInterpretation(prediction, data.error);
            interpretationText.style.display = "block";
            updateHistory(prediction, null, selectedChar ? `Character '${selectedChar}'` : "Unlabeled Sample");
            return;
        }

        const prediction = data.prediction;
        const badgeClass = prediction === "Normal" ? "normal" : "reversal";

        resultSpan.innerHTML = `<span class="badge ${badgeClass}">${prediction}</span>`;
        const cleanNum = String(data.confidence).replace("%", "");
        confidenceSpan.innerText = cleanNum;
        confidenceBar.style.width = `${Math.min(100, Math.max(0, parseFloat(cleanNum) || 0))}%`;
        confidenceText.style.display = "block";

        interpretationText.innerText = getInterpretation(prediction);
        interpretationText.style.display = "block";

        updateChecklistStatus(selectedChar, prediction);
        updateHistory(prediction, data.confidence, selectedChar ? `Character '${selectedChar}'` : "Unlabeled Sample");
    } catch (error) {
        resultSpan.innerText = "Error: Server connection failed.";
        interpretationText.style.display = "none";
    }
}

async function sendWordImage(blob) {
    const targetWord = document.getElementById("target-word-input").value.trim();
    const formData = new FormData();
    formData.append("file", blob, "word.png");
    formData.append("target_word", targetWord);

    resultSpan.innerText = "Segmenting Word...";
    confidenceText.style.display = "none";
    wordBreakdownEl.style.display = "none";
    interpretationText.style.display = "none";

    try {
        const response = await fetch("/predict_word", { method: "POST", body: formData });
        const data = await response.json();

        if (!response.ok || data.error) {
            const prediction = "Invalid input";
            resultSpan.innerHTML = `<span class="badge invalid">${prediction}</span>`;
            interpretationText.innerText = data.error || "Could not segment word.";
            interpretationText.style.display = "block";
            updateHistory(prediction, null, targetWord ? `Word '${targetWord}'` : "Word Sample");
            return;
        }

        const prediction = data.prediction;
        const badgeClass = prediction === "Normal" ? "normal" : "reversal";
        resultSpan.innerHTML = `<span class="badge ${badgeClass}">${prediction} (${data.reversal_count}/${data.segmented_count} rev)</span>`;

        const cleanNum = String(data.confidence).replace("%", "");
        confidenceSpan.innerText = cleanNum;
        confidenceBar.style.width = `${Math.min(100, Math.max(0, parseFloat(cleanNum) || 0))}%`;
        confidenceText.style.display = "block";

        wordBreakdownEl.innerHTML = data.characters.map((ch) => {
            const cls = ch.prediction === "Normal" ? "normal" : "reversal";
            const icon = ch.prediction === "Normal" ? "✓" : "⚑";
            return `<span class="seg-chip ${cls}">#${ch.index} '${ch.expected}': ${ch.prediction} ${icon}</span>`;
        }).join("");
        wordBreakdownEl.style.display = "flex";

        interpretationText.innerText = prediction === "Reversal"
            ? `Segmented ${data.segmented_count} characters: ${data.reversal_count} character(s) showed mirror reversal.`
            : `All ${data.segmented_count} segmented characters showed standard orientation.`;
        interpretationText.style.display = "block";

        const label = targetWord ? `Word '${targetWord}'` : `Word (${data.segmented_count} chars)`;
        updateHistory(prediction, data.confidence, label);
    } catch (error) {
        resultSpan.innerText = "Error: Server connection failed.";
        interpretationText.style.display = "none";
    }
}

function updateHistory(prediction, confidence, labelText) {
    history.unshift({ prediction, confidence, labelText });
    if (history.length > 5) history.pop();

    if (prediction === "Normal" || prediction === "Reversal") {
        totalValidCount += 1;
        if (prediction === "Reversal") {
            totalReversalCount += 1;
        }
    }

    historyLog.innerHTML = history.map((item) => {
        const cleanConf = item.confidence ? String(item.confidence).replace("%", "") : "";
        const confText = item.prediction !== "Invalid input" && cleanConf
            ? ` (${cleanConf}%)`
            : "";
        return `<div class="history-item"><span>${item.labelText}</span><strong>${item.prediction}${confText}</strong></div>`;
    }).join("");

    const reversalRate = totalValidCount > 0
        ? Math.round((totalReversalCount / totalValidCount) * 100)
        : 0;
    reversalRateSpan.innerText = reversalRate;

    if (totalValidCount >= 3) {
        riskBanner.classList.remove("risk-low", "risk-moderate", "risk-high");
        if (reversalRate < 25) {
            riskBanner.classList.add("risk-low");
            riskBanner.innerText = `Screening Risk Indicator: Low Risk (${reversalRate}% reversals)`;
        } else if (reversalRate <= 50) {
            riskBanner.classList.add("risk-moderate");
            riskBanner.innerText = `Screening Risk Indicator: Moderate Indicator (${reversalRate}% reversals)`;
        } else {
            riskBanner.classList.add("risk-high");
            riskBanner.innerText = `Screening Risk Indicator: High Reversal Indicator (${reversalRate}% reversals)`;
        }
        riskBanner.style.display = "block";
    } else {
        riskBanner.style.display = "none";
    }
}