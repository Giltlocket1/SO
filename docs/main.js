// ===========================================
// main.js: CONTROL INDIVIDUAL DE PROCESOS Y SINCRONIZACIÓN
// Corregido: usar solo timestamps del MAIN para duración
// ===========================================

const MAX_QUEUE_SIZE = 5;
let colaCompartida = [];
let stats = {};
let workers = {};
let runningStatus = {
    productor: false,
    consumidor: false,
    calculo: false
};

const LIMITES = {
    productor: 10,
    consumidor: 10,
    calculo: 5
};

const $colaSize = document.getElementById('cola-size');
const $statsArea = document.getElementById('stats-area');
const $iniciarBtn = document.getElementById('iniciar-simulacion');
const $simulacionMensaje = document.getElementById('simulacion-mensaje');

// --- UTILIDADES ---
const ensureStats = (name) => {
    if (!stats[name]) {
        stats[name] = { startTime: null, endTime: null, count: 0 };
    }
};

const initAllStats = () => {
    // Inicializa stats para todos los procesos (útil al reiniciar)
    Object.keys(LIMITES).forEach(k => {
        stats[k] = { startTime: null, endTime: null, count: 0 };
    });
};

const updateStatsCount = (name, count) => {
    ensureStats(name);
    if (typeof count === 'number') {
        stats[name].count = count;
    }
};

const pulseCard = (id) => {
    const $card = document.getElementById(`card-${id}`);
    if ($card) {
        $card.classList.add('pulse-active');
        setTimeout(() => $card.classList.remove('pulse-active'), 100);
    }
};

const actualizarUI = (id, estado, count) => {
    const $estado = document.getElementById(`estado-${id}`);
    const $card = document.getElementById(`card-${id}`);
    const $progressBar = document.getElementById(`${id}-bar`);
    const $countText = document.getElementById(`${id}-count-text`);
    const limit = LIMITES[id];

    if ($estado) {
        $estado.textContent = estado;
        $estado.className = `badge ${estado === 'Corriendo' ? 'bg-running' : estado === 'Esperando' || estado === 'Pausado' ? 'bg-waiting' : 'bg-finished'}`;
    }

    if (typeof count === 'number' && $progressBar) {
        const percentage = Math.min((count / limit) * 100, 100);
        $progressBar.style.width = `${percentage}%`;
        $progressBar.setAttribute('aria-valuenow', count);
        if ($countText) $countText.textContent = `${count}/${limit}`;
    }

    if ((estado === 'Finalizado' || estado === 'Terminado (Forzado)') && $card) {
        $card.classList.add('opacity-50');
        if ($progressBar) $progressBar.style.width = '100%';
    }

    if (estado === 'Terminado (Forzado)' && $progressBar) {
        $progressBar.classList.remove('progress-bar-animated', 'progress-bar-striped');
    }
};

const actualizarCola = () => {
    if ($colaSize) $colaSize.textContent = colaCompartida.length;

    if (colaCompartida.length < MAX_QUEUE_SIZE && workers.productor && runningStatus.productor) {
        workers.productor.postMessage({ command: 'can_produce' });
    }
    if (colaCompartida.length > 0 && workers.consumidor && runningStatus.consumidor) {
        workers.consumidor.postMessage({ command: 'can_consume' });
    }
};

const mostrarEstadisticas = () => {
    let html = '<h4>Tiempos de Ejecución (ms)</h4>';
    // Aseguramos que exista una fila para cada proceso
    Object.keys(LIMITES).forEach(name => {
        const data = stats[name] || { startTime: null, endTime: null, count: 0 };
        const start = (typeof data.startTime === 'number') ? data.startTime.toFixed(2) + ' ms' : (data.startTime ? data.startTime : '---');
        const end = (typeof data.endTime === 'number') ? data.endTime.toFixed(2) + ' ms' : (data.endTime ? data.endTime : '---');
        let duration = '---';
        if (typeof data.startTime === 'number' && typeof data.endTime === 'number') {
            duration = (Math.max(0, data.endTime - data.startTime)).toFixed(2) + ' ms';
        } else if (typeof data.startTime === 'number' && !data.endTime) {
            duration = 'Calculando...';
        }

        html += `<p class="mb-1"><strong>${name.toUpperCase()}</strong>:</p>`;
        html += `<ul class="list-unstyled ms-3">
            <li>Inicio: ${start}</li>
            <li>Fin: ${end}</li>
            <li>Duración: ${duration}</li>
            <li>Tareas Completadas: ${data.count ?? 0}</li>
        </ul>`;
    });

    if ($statsArea) $statsArea.innerHTML = html;
};

// --- CONTROL INDIVIDUAL ---
const toggleWorker = (workerName) => {
    const $button = document.getElementById(`btn-${workerName}-control`);

    if (!workers[workerName]) {
        if ($simulacionMensaje) $simulacionMensaje.innerHTML = '<div class="alert alert-danger">⚠️ Error: Presiona "Inicializar Simulación" primero.</div>';
        return;
    }

    if (stats[workerName] && stats[workerName].endTime) return;

    if (runningStatus[workerName]) {
        // Pausar
        runningStatus[workerName] = false;
        workers[workerName].postMessage({ command: 'pause' });
        if ($button) {
            $button.textContent = 'Reanudar';
            $button.classList.remove('btn-danger');
            $button.classList.add('btn-success');
        }
        actualizarUI(workerName, 'Pausado', stats[workerName] ? stats[workerName].count : 0);
    } else {
        // Iniciar/Reanudar
        runningStatus[workerName] = true;
        // Si es el primer inicio, inicializamos startTime Y enviamos 'start'
        if (!stats[workerName] || !stats[workerName].startTime) {
            ensureStats(workerName);
            stats[workerName].startTime = performance.now(); // <-- importante: timestamp del MAIN
            workers[workerName].postMessage({ command: 'start', limit: LIMITES[workerName] });
        } else {
            // Reanudar
            workers[workerName].postMessage({ command: 'resume' });
        }

        if ($button) {
            $button.textContent = 'Detener';
            $button.classList.remove('btn-success');
            $button.classList.add('btn-danger');
        }

        actualizarUI(workerName, 'Corriendo', stats[workerName] ? stats[workerName].count : 0);
        actualizarCola();
    }
};

const killWorker = (workerName) => {
    const $buttonControl = document.getElementById(`btn-${workerName}-control`);
    const $buttonKill = document.getElementById(`btn-${workerName}-kill`);

    if (!workers[workerName]) {
        if ($simulacionMensaje) $simulacionMensaje.innerHTML = `<div class="alert alert-danger">⚠️ Error: ${workerName} ya está inactivo o no se ha inicializado.</div>`;
        return;
    }

    try {
        workers[workerName].terminate();
    } catch (e) { /* ignore */ }
    delete workers[workerName];

    ensureStats(workerName);
    // Registro del tiempo final en el MAIN (no usar msg.time del worker)
    stats[workerName].endTime = performance.now();
    runningStatus[workerName] = false;

    actualizarUI(workerName, 'Terminado (Forzado)', stats[workerName].count);

    if ($buttonControl) {
        $buttonControl.textContent = 'Terminado';
        $buttonControl.disabled = true;
        $buttonControl.classList.remove('btn-danger', 'btn-success');
        $buttonControl.classList.add('btn-secondary');
    }
    if ($buttonKill) {
        $buttonKill.textContent = 'Inactivo';
        $buttonKill.disabled = true;
    }

    mostrarEstadisticas();

    if (Object.keys(workers).length === 0) {
        if ($simulacionMensaje) $simulacionMensaje.innerHTML = '<div class="alert alert-warning">🛑 Simulación Detenida. Todos los procesos están inactivos o terminados.</div>';
        if ($iniciarBtn) {
            $iniciarBtn.disabled = false;
            $iniciarBtn.textContent = 'Reiniciar Simulación';
        }
    }
    actualizarCola();
};

// --- Manejo Mensajes de Workers ---
const handleWorkerMessage = (event) => {
    const msg = event.data;
    const workerName = msg.source;
    ensureStats(workerName);

    // Nota: no usamos msg.time para cómputo de duración (reloj del worker NO sincronizado)
    if (msg.action === 'start') {
        // El MAIN ya guardó startTime cuando envió 'start' (toggleWorker o iniciarSimulacion).
        actualizarUI(workerName, 'Corriendo', stats[workerName].count || 0);
        mostrarEstadisticas();
        return;
    }

    // PRODUCE
    if (msg.action === 'produce') {
        if (colaCompartida.length < MAX_QUEUE_SIZE) {
            colaCompartida.push(msg.payload);
            stats[workerName].count = (stats[workerName].count || 0) + 1;

            if (workers[workerName]) workers[workerName].postMessage({ command: 'production_confirmed', count: stats[workerName].count });

            actualizarCola();
            pulseCard('productor');
            actualizarUI('productor', 'Corriendo', stats[workerName].count);
        } else {
            if (workers.productor) workers.productor.postMessage({ command: 'wait_for_space' });
            actualizarUI('productor', 'Esperando', stats[workerName].count);
        }

    // CONSUME
    } else if (msg.action === 'consume') {
        if (colaCompartida.length > 0) {
            colaCompartida.shift();
            stats[workerName].count = (stats[workerName].count || 0) + 1;

            if (workers[workerName]) workers[workerName].postMessage({ command: 'consumption_confirmed', count: stats[workerName].count });

            actualizarCola();
            pulseCard('consumidor');
            actualizarUI('consumidor', 'Corriendo', stats[workerName].count);
        } else {
            if (workers.consumidor) workers.consumidor.postMessage({ command: 'wait_for_item' });
            actualizarUI('consumidor', 'Esperando', stats[workerName].count);
        }

    // CALCULATED (calculo)
    } else if (msg.action === 'calculated') {
        stats['calculo'].count = msg.count;
        pulseCard('calculo');
        actualizarUI('calculo', 'Corriendo', stats['calculo'].count);

    // FINISH
    } else if (msg.action === 'finish') {
        // Registrar tiempo final con el MAIN clock (performance.now())
        stats[workerName].count = (typeof msg.count === 'number') ? msg.count : stats[workerName].count;
        stats[workerName].endTime = performance.now();

        actualizarUI(workerName, 'Finalizado', stats[workerName].count);
        runningStatus[workerName] = false;

        const $control = document.getElementById(`btn-${workerName}-control`);
        const $kill = document.getElementById(`btn-${workerName}-kill`);
        if ($control) { $control.textContent = 'Finalizado'; $control.disabled = true; }
        if ($kill) { $kill.disabled = true; }

        if (workers[workerName]) {
            try { workers[workerName].terminate(); } catch (e) {}
            delete workers[workerName];
        }

        if (Object.keys(LIMITES).every(k => stats[k] && stats[k].endTime)) {
            if ($iniciarBtn) { $iniciarBtn.disabled = false; $iniciarBtn.textContent = 'Reiniciar Simulación'; }
            if ($simulacionMensaje) $simulacionMensaje.innerHTML = '<div class="alert alert-success">✅ Simulación Terminada. Revisa las estadísticas abajo.</div>';
        }
    }

    mostrarEstadisticas();
};

// --- Inicialización ---
const iniciarSimulacion = () => {
    // Terminar workers previos
    Object.values(workers).forEach(w => { try { if (w && typeof w.terminate === 'function') w.terminate(); } catch (e) {} });

    // Crear nuevos workers
    workers = {
        productor: new Worker('worker-productor.js'),
        consumidor: new Worker('worker-consumidor.js'),
        calculo: new Worker('worker-calculo.js')
    };

    // Attach handlers y errores
    Object.keys(workers).forEach(k => {
        workers[k].onmessage = handleWorkerMessage;
        workers[k].onerror = (err) => {
            console.error(`Error en worker ${k}:`, err);
            if ($simulacionMensaje) $simulacionMensaje.innerHTML = `<div class="alert alert-danger">Error en worker ${k}: ${err.message}</div>`;
        };
    });

    colaCompartida = [];
    initAllStats(); // <-- inicializa startTime/null endTime/count=0
    runningStatus = {productor:false, consumidor:false, calculo:false};

    ['productor', 'consumidor', 'calculo'].forEach(id => {
        const $countText = document.getElementById(`${id}-count-text`);
        const $estado = document.getElementById(`estado-${id}`);
        const $card = document.getElementById(`card-${id}`);
        const $progressBar = document.getElementById(`${id}-bar`);
        const $button = document.getElementById(`btn-${id}-control`);
        const $killButton = document.getElementById(`btn-${id}-kill`);

        if ($countText) $countText.textContent = `0/${LIMITES[id]}`;
        if ($estado) $estado.textContent = 'Inactivo';
        if ($card) $card.classList.remove('opacity-50');
        if ($progressBar) $progressBar.style.width = '0%';
        if ($button) { $button.textContent = 'Iniciar'; $button.disabled = false; $button.classList.remove('btn-danger','btn-secondary'); $button.classList.add('btn-success'); }
        if ($killButton) { $killButton.textContent = 'Terminar'; $killButton.disabled = false; }
    });

    if ($iniciarBtn) { $iniciarBtn.disabled = false; $iniciarBtn.textContent = 'Reiniciar Simulación'; }
    if ($simulacionMensaje) $simulacionMensaje.innerHTML = '<div class="alert alert-info">✅ Simulación Lista. Presiona "Iniciar" en cada proceso.</div>';

    actualizarCola();
    mostrarEstadisticas();
};

// --- Event listeners ---
document.addEventListener('DOMContentLoaded', () => {
    if ($iniciarBtn) $iniciarBtn.addEventListener('click', iniciarSimulacion);

    document.getElementById('btn-productor-control').addEventListener('click', () => toggleWorker('productor'));
    document.getElementById('btn-consumidor-control').addEventListener('click', () => toggleWorker('consumidor'));
    document.getElementById('btn-calculo-control').addEventListener('click', () => toggleWorker('calculo'));

    document.getElementById('btn-productor-kill').addEventListener('click', () => killWorker('productor'));
    document.getElementById('btn-consumidor-kill').addEventListener('click', () => killWorker('consumidor'));
    document.getElementById('btn-calculo-kill').addEventListener('click', () => killWorker('calculo'));

    iniciarSimulacion();
});
