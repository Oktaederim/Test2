document.addEventListener('DOMContentLoaded', () => {
    // === GEMEINSAME FUNKTIONEN UND VARIABLEN ===
    const notificationArea = document.getElementById('notification-area');
    const showNotification = (message, type = 'error') => {
        notificationArea.textContent = message;
        notificationArea.className = `notification ${type}`;
    };
    const clearNotification = () => notificationArea.className = 'notification hidden';
    const isComfortable = (t, rh) => (t >= 20 && t <= 26 && rh >= 40 && rh <= 60);

    function calculateState(t, rh, p = 1013.25) {
        if (isNaN(t) || isNaN(rh) || isNaN(p)) return null;
        const SDD = 6.112 * Math.exp((17.62 * t) / (243.12 + t));
        const DD = (rh / 100) * SDD;
        const v = Math.log(DD / 6.112);
        const Td = (243.12 * v) / (17.62 - v);
        const x_g_kg = 622 * (DD / (p - DD));
        const h = 1.006 * t + (x_g_kg / 1000) * (2501 + 1.86 * t);
        const T_kelvin = t + 273.15;
        const rho = ((p - DD) * 100) / (287.058 * T_kelvin) + (DD * 100) / (461.52 * T_kelvin);
        const Tw = t * Math.atan(0.151977 * Math.pow(rh + 8.313659, 0.5)) + Math.atan(t + rh) - Math.atan(rh - 1.676331) + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - 4.686035;
        const comfortable = isComfortable(t, rh);
        return { t, rh, p, Td, x_g_kg, h, rho, Tw, comfortable };
    }

    // === MODUS-UMSCHALTUNG ===
    const btnComparator = document.getElementById('btn-mode-comparator');
    const btnSimulator = document.getElementById('btn-mode-simulator');
    const comparatorModeDiv = document.getElementById('comparator-mode');
    const simulatorModeDiv = document.getElementById('simulator-mode');

    btnComparator.addEventListener('click', () => {
        comparatorModeDiv.classList.remove('hidden');
        simulatorModeDiv.classList.add('hidden');
        btnComparator.classList.add('active');
        btnSimulator.classList.remove('active');
    });

    btnSimulator.addEventListener('click', () => {
        simulatorModeDiv.classList.remove('hidden');
        comparatorModeDiv.classList.add('hidden');
        btnSimulator.classList.add('active');
        btnComparator.classList.remove('active');
    });

    // === LOGIK FÜR MODUS 1: ZUSTANDSVERGLEICH ===
    const comp = {
        inputs: {
            v_flow: document.getElementById('comp-volume-flow'),
            t_initial: document.getElementById('comp-temp-initial'),
            rh_initial: document.getElementById('comp-rh-initial'),
            t_target: document.getElementById('comp-temp-target'),
            rh_target: document.getElementById('comp-rh-target'),
        },
        outputs: {
            initial: { x_g_kg: document.getElementById('comp-x-initial-g-kg'), h: document.getElementById('comp-h-initial'), td: document.getElementById('comp-td-initial'), tw: document.getElementById('comp-tw-initial'), comfort: document.getElementById('comp-comfort-initial') },
            target: { x_g_kg: document.getElementById('comp-x-target-g-kg'), h: document.getElementById('comp-h-target'), td: document.getElementById('comp-td-target'), tw: document.getElementById('comp-tw-target'), comfort: document.getElementById('comp-comfort-target') },
            process: { power_heat: document.getElementById('comp-power-heat'), power_cool: document.getElementById('comp-power-cool'), water_diff: document.getElementById('comp-water-diff') }
        }
    };

    function updateComparator() {
        if (parseFloat(comp.inputs.rh_initial.value) > 100 || parseFloat(comp.inputs.rh_target.value) > 100 || parseFloat(comp.inputs.rh_initial.value) < 0 || parseFloat(comp.inputs.rh_target.value) < 0) {
            showNotification('Relative Feuchte muss zwischen 0 und 100% liegen.');
            return;
        }
        clearNotification();
        const initial_state = calculateState(parseFloat(comp.inputs.t_initial.value), parseFloat(comp.inputs.rh_initial.value));
        const target_state = calculateState(parseFloat(comp.inputs.t_target.value), parseFloat(comp.inputs.rh_target.value));
        const v_flow = parseFloat(comp.inputs.v_flow.value);

        if (!initial_state || !target_state || isNaN(v_flow)) return;

        const updateStateUI = (state, ui) => {
            ui.x_g_kg.textContent = `${state.x_g_kg.toFixed(2)} g/kg`;
            ui.h.textContent = `${state.h.toFixed(2)} kJ/kg`;
            ui.td.textContent = `${state.Td.toFixed(1)} °C`;
            ui.tw.textContent = `${state.Tw.toFixed(1)} °C`;
            ui.comfort.className = state.comfortable ? 'comfort-status' : 'comfort-status hidden';
            if (state.comfortable) { ui.comfort.textContent = '✅ Im Behaglichkeitsfeld'; ui.comfort.classList.remove('warning'); ui.comfort.classList.add('success'); }
            else { ui.comfort.textContent = '⚠️ Außerhalb Behaglichkeitsfeld'; ui.comfort.classList.remove('success'); ui.comfort.classList.add('warning'); }
        };
        updateStateUI(initial_state, comp.outputs.initial);
        updateStateUI(target_state, comp.outputs.target);

        const m_dot = (v_flow * initial_state.rho) / 3600;
        let cooling_power = 0, heating_power = 0;
        if (target_state.x_g_kg < initial_state.x_g_kg) {
            const intermediate_state = calculateState(target_state.Td, 100);
            if(intermediate_state){ cooling_power = m_dot * (intermediate_state.h - initial_state.h); heating_power = m_dot * (target_state.h - intermediate_state.h); }
        } else {
            const total_power = m_dot * (target_state.h - initial_state.h);
            if (total_power > 0) heating_power = total_power; else cooling_power = total_power;
        }
        comp.outputs.process.power_heat.textContent = `${Math.abs(heating_power).toFixed(2)} kW`;
        comp.outputs.process.power_cool.textContent = `${Math.abs(cooling_power).toFixed(2)} kW`;
        const water_diff_kg_h = m_dot * (target_state.x_g_kg - initial_state.x_g_kg) * 3600 / 1000;
        comp.outputs.process.water_diff.textContent = `${Math.abs(water_diff_kg_h).toFixed(2)} kg/h (${water_diff_kg_h > 0 ? 'Befeuchtung' : 'Entfeuchtung'})`;
    }
    Object.values(comp.inputs).forEach(input => input.addEventListener('input', updateComparator));
    
    // === LOGIK FÜR MODUS 2: PROZESS-SIMULATION ===
    const sim = {
        inputs: { t: document.getElementById('sim-temperature'), rh: document.getElementById('sim-humidity'), p: document.getElementById('sim-pressure'), v_flow: document.getElementById('sim-volume-flow'), processSelect: document.getElementById('sim-process-select'), targetValue: document.getElementById('sim-target-value'), targetLabel: document.getElementById('sim-target-label') },
        outputs: { current: { x: document.getElementById('sim-current-x'), h: document.getElementById('sim-current-h'), td: document.getElementById('sim-current-td'), rho: document.getElementById('sim-current-rho') }, resultCard: document.getElementById('sim-result-card'), result: { t: document.getElementById('sim-result-t'), rh: document.getElementById('sim-result-rh'), x: document.getElementById('sim-result-x'), powerLabel: document.getElementById('sim-power-label'), powerValue: document.getElementById('sim-power-value'), waterDiff: document.getElementById('sim-water-diff') } },
        buttons: { apply: document.getElementById('sim-apply-process-btn'), useAsStart: document.getElementById('sim-use-as-start-btn') }
    };

    let sim_currentState = {}, sim_resultState = {};

    function calculateStateFrom_t_x(t, x_g_kg, p) { const x_ratio = x_g_kg / 1000; const DD = p / (1 + (622 / x_ratio)); const SDD = 6.112 * Math.exp((17.62 * t) / (243.12 + t)); return calculateState(t, (DD / SDD) * 100, p); }
    
    function updateSimulatorUI() {
        const t = parseFloat(sim.inputs.t.value), rh = parseFloat(sim.inputs.rh.value), p = parseFloat(sim.inputs.p.value);
        sim_currentState = calculateState(t, rh, p);
        if (sim_currentState) {
            sim.outputs.current.x.textContent = `${sim_currentState.x_g_kg.toFixed(2)} g/kg`;
            sim.outputs.current.h.textContent = `${sim_currentState.h.toFixed(2)} kJ/kg`;
            sim.outputs.current.td.textContent = `${sim_currentState.Td.toFixed(1)} °C`;
            sim.outputs.current.rho.textContent = `${sim_currentState.rho.toFixed(3)} kg/m³`;
        }
    }

    function handleProcessChange() {
        switch (sim.inputs.processSelect.value) {
            case 'heat': case 'cool': sim.inputs.targetLabel.textContent = 'Ziel-Temperatur (°C)'; break;
            case 'steam_humidify': sim.inputs.targetLabel.textContent = 'Ziel-Absolute Feuchte (g/kg)'; break;
        }
    }

    function applySimProcess() {
        const process = sim.inputs.processSelect.value, targetValue = parseFloat(sim.inputs.targetValue.value), v_flow = parseFloat(sim.inputs.v_flow.value);
        if (isNaN(targetValue) || isNaN(v_flow) || !sim_currentState) return;
        let power = 0, powerLabel = 'Leistung';
        switch (process) {
            case 'heat': sim_resultState = calculateStateFrom_t_x(targetValue, sim_currentState.x_g_kg, sim_currentState.p); powerLabel = "Heizleistung"; break;
            case 'cool': sim_resultState = targetValue < sim_currentState.Td ? calculateState(targetValue, 100, sim_currentState.p) : calculateStateFrom_t_x(targetValue, sim_currentState.x_g_kg, sim_currentState.p); powerLabel = "Kühlleistung"; break;
            case 'steam_humidify': sim_resultState = calculateStateFrom_t_x(sim_currentState.t, targetValue, sim_currentState.p); powerLabel = "Heizleistung (Befeuchtung)"; break;
        }
        power = (v_flow * sim_currentState.rho / 3600) * (sim_resultState.h - sim_currentState.h);
        displaySimResult(power, powerLabel);
    }
    
    function displaySimResult(power, powerLabel){
        if (!sim_resultState) return;
        sim.outputs.result.t.textContent = `${sim_resultState.t.toFixed(1)} °C`;
        sim.outputs.result.rh.textContent = `${sim_resultState.rh.toFixed(1)} %`;
        sim.outputs.result.x.textContent = `${sim_resultState.x_g_kg.toFixed(2)} g/kg`;
        sim.outputs.result.powerLabel.textContent = powerLabel;
        sim.outputs.result.powerValue.textContent = `${Math.abs(power).toFixed(2)} kW`;
        sim.outputs.result.powerValue.className = power >= 0 ? 'value heat-value' : 'value cool-value';
        const water_diff = (sim_resultState.x_g_kg - sim_currentState.x_g_kg) * (parseFloat(sim.inputs.v_flow.value) * sim_currentState.rho) / 1000;
        sim.outputs.result.waterDiff.textContent = `${Math.abs(water_diff).toFixed(2)} kg/h (${water_diff >= 0 ? "Befeuchtung" : "Entfeuchtung"})`;
        sim.outputs.resultCard.classList.remove('hidden');
    }

    function useResultAsStart(){
        if(!sim_resultState) return;
        sim.inputs.t.value = sim_resultState.t.toFixed(1);
        sim.inputs.rh.value = sim_resultState.rh.toFixed(1);
        updateSimulatorUI();
        sim.outputs.resultCard.classList.add('hidden');
    }

    Object.values(sim.inputs).forEach(input => { if(input.id !== 'sim-process-select' && input.id !== 'sim-target-value'){ input.addEventListener('input', updateSimulatorUI); }});
    sim.inputs.processSelect.addEventListener('change', handleProcessChange);
    sim.buttons.apply.addEventListener('click', applySimProcess);
    sim.buttons.useAsStart.addEventListener('click', useResultAsStart);

    // === INITIALISIERUNG BEIM LADEN ===
    updateComparator();
    updateSimulatorUI();
});
