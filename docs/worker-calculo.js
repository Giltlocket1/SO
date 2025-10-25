// ===========================================
// worker-calculo.js
// ===========================================
let limit = 0;
let primeCount = 0;
let currentNum = 2;
let isPaused = false;
const ITERATIONS_PER_TICK = 10000;

function sendMessage(action) {
    postMessage({
        source: 'calculo',
        action: action,
        time: performance.now(),
        count: primeCount
    });
}

function isPrime(num) {
    if (num <= 1) return false;
    for (let i = 2; i <= Math.sqrt(num); i++) {
        if (num % i === 0) return false;
    }
    return true;
}

function runCalculo() {
    if (isPaused) return;
    if (primeCount >= limit) { sendMessage('finish'); return; }

    let iterations = 0;
    while (iterations < ITERATIONS_PER_TICK) {
        if (isPrime(currentNum)) {
            primeCount++;
            sendMessage('calculated');
            currentNum++;
            break;
        }
        currentNum++;
        iterations++;
        if (primeCount >= limit) { sendMessage('finish'); return; }
    }

    setTimeout(runCalculo, 0);
}

onmessage = function(e) {
    const msg = e.data;

    if (msg.command === 'start') {
        limit = msg.limit;
        primeCount = 0;
        currentNum = 2;
        isPaused = false;
        sendMessage('start');
        setTimeout(runCalculo, 0);

    } else if (msg.command === 'pause') {
        isPaused = true;

    } else if (msg.command === 'resume') {
        if (isPaused) isPaused = false;
        setTimeout(runCalculo, 0);
    }
};
