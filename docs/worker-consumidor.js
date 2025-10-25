// ===========================================
// worker-consumidor.js
// ===========================================
let limit = 0;
let consumedCount = 0;
let isPaused = false;
let isWaitingForItem = false;
const delay = 700;

function sendMessage(action, payload = null) {
    postMessage({
        source: 'consumidor',
        action: action,
        payload: payload,
        time: performance.now(),
        count: consumedCount
    });
}

function simulateWork() {
    for (let i = 0; i < 500000; i++) Math.pow(i, 0.5);
}

function runConsumo() {
    if (isPaused) return;
    if (consumedCount >= limit) { sendMessage('finish'); return; }
    if (isWaitingForItem) return;

    simulateWork();

    // Solicita al Main consumir
    sendMessage('consume');
    // Espera confirmación 'consumption_confirmed' para continuar
}

onmessage = function(e) {
    const msg = e.data;

    if (msg.command === 'start') {
        limit = msg.limit;
        consumedCount = 0;
        isPaused = false;
        isWaitingForItem = false;
        sendMessage('start');
        setTimeout(runConsumo, delay);

    } else if (msg.command === 'pause') {
        isPaused = true;

    } else if (msg.command === 'resume') {
        if (isPaused) isPaused = false;
        setTimeout(runConsumo, 0);

    } else if (msg.command === 'wait_for_item') {
        isWaitingForItem = true;

    } else if (msg.command === 'can_consume') {
        if (isWaitingForItem) {
            isWaitingForItem = false;
            setTimeout(runConsumo, 0);
        }

    } else if (msg.command === 'consumption_confirmed') {
        consumedCount = msg.count ?? consumedCount;
        if (consumedCount < limit) {
            setTimeout(runConsumo, delay);
        } else {
            sendMessage('finish');
        }
    }
};
