// ===========================================
// worker-productor.js
// ===========================================
let limit = 0;
let producedCount = 0;
let isPaused = false;
let isWaitingForSpace = false;
const delay = 500;

function sendMessage(action, payload = null) {
    postMessage({
        source: 'productor',
        action: action,
        payload: payload,
        time: performance.now(),
        count: producedCount
    });
}

function isBusyWork() {
    for (let i = 0; i < 1000000; i++) Math.sqrt(i);
}

function runProduction() {
    if (isPaused) return;
    if (producedCount >= limit) { sendMessage('finish'); return; }
    if (isWaitingForSpace) return;

    isBusyWork();

    sendMessage('produce', `Mensaje N°${producedCount + 1}`);
    // No repetir aquí: se reanudará en 'production_confirmed'
}

onmessage = function(e) {
    const msg = e.data;

    if (msg.command === 'start') {
        limit = msg.limit;
        producedCount = 0;
        isPaused = false;
        isWaitingForSpace = false;
        sendMessage('start');
        setTimeout(runProduction, delay);

    } else if (msg.command === 'pause') {
        isPaused = true;

    } else if (msg.command === 'resume') {
        if (isPaused) isPaused = false;
        // si no estaba esperando, intentar producir
        setTimeout(runProduction, 0);

    } else if (msg.command === 'wait_for_space') {
        isWaitingForSpace = true;

    } else if (msg.command === 'can_produce') {
        if (isWaitingForSpace) {
            isWaitingForSpace = false;
            setTimeout(runProduction, 0);
        }

    } else if (msg.command === 'production_confirmed') {
        producedCount = msg.count ?? producedCount;
        if (producedCount < limit) {
            setTimeout(runProduction, delay);
        } else {
            sendMessage('finish');
        }
    }
};
