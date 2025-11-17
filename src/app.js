// API Configuration
const API_BASE_URL = 'http://20.246.73.238:5051/api';
const REFRESH_INTERVAL = 30000; // 30 seconds

// State management
const appState = {
  currentView: 'dashboard',
  currentCamera: 'LPR1',
  currentStation: 'EST1',
  currentMonitor: 'EV-001',
  data: {
    cameras: { LPR1: {}, LPR2: {}, LPR3: {} },
    environmental: { EST1: {}, EST2: {}, EST3: {} },
    energy: { 'EV-001': {}, 'EV-002': {}, 'EV-003': {}, 'EV-004': {} },
    devices: []
  },
  charts: {},
  autoRefresh: true,
  refreshTimer: null
};

appState.data.cameras = {
  LPR1: { maxRows: 20 },
  LPR2: { maxRows: 20 },
  LPR3: { maxRows: 20 }
};
appState.data.environmental = {
  EST1: { maxRows: 20 },
  EST2: { maxRows: 20 },
  EST3: { maxRows: 20 }
};
appState.data.energy = {
  'EV-001': { maxRows: 20 },
  'EV-002': { maxRows: 20 },
  'EV-003': { maxRows: 20 },
  'EV-004': { maxRows: 20 }
};

// Utility functions
function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function updateCurrentDateTime() {
  const now = new Date();
  const dateTimeStr = now.toLocaleString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById('current-datetime').textContent = dateTimeStr;
}

// API functions
async function fetchData(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    console.log('Status:', response.status);
    const text = await response.text();
    console.log('Raw response:', text);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    return null;
  }
}

async function loadCameraData(cameraId) {
  const actual = await fetchData(`/monitor_acceso_${cameraId}/actual`);
  const historico = await fetchData(`/monitor_acceso_${cameraId}/historico`);
  
  appState.data.cameras[cameraId] = {
    actual: actual || [],
    historico: historico || []
  };
  
  if (appState.currentView === 'cameras' && appState.currentCamera === cameraId) {
    renderCameraView();
  }
}

async function loadEnvironmentalData(stationId) {
  const actual = await fetchData(`/monitor_ambiental_${stationId}/actual`);
  const historico = await fetchData(`/monitor_ambiental_${stationId}/historico`);
  
  appState.data.environmental[stationId] = {
    actual: actual || [],
    historico: historico || []
  };
  
  if (appState.currentView === 'environmental' && appState.currentStation === stationId) {
    renderEnvironmentalView();
  }
}

async function loadEnergyData(monitorId) {
  const actual = await fetchData(`/monitor_energia_${monitorId}/actual`);
  const historico = await fetchData(`/monitor_energia_${monitorId}/historico`);
  
  appState.data.energy[monitorId] = {
    actual: actual || [],
    historico: historico || []
  };
  
  if (appState.currentView === 'energy' && appState.currentMonitor === monitorId) {
    renderEnergyView();
  }
}

async function loadDevices() {
  const devices = await fetchData('/dispositivos');
  appState.data.devices = devices || [];
  
  if (appState.currentView === 'devices') {
    renderDevicesView();
  }
}

async function loadAllData() {
  // Load cameras
  await Promise.all([
    loadCameraData('LPR1'),
    loadCameraData('LPR2'),
    loadCameraData('LPR3')
  ]);
  
  // Load environmental
  await Promise.all([
    loadEnvironmentalData('EST1'),
    loadEnvironmentalData('EST2'),
    loadEnvironmentalData('EST3')
  ]);
  
  // Load energy
  await Promise.all([
    loadEnergyData('EV-001'),
    loadEnergyData('EV-002'),
    loadEnergyData('EV-003'),
    loadEnergyData('EV-004')
  ]);
  
  // Load devices
  await loadDevices();
  
  // Update dashboard
  if (appState.currentView === 'dashboard') {
    renderDashboard();
  }
}

// Render functions
function renderDashboard() {
  // Update stats
  let totalEvents = 0;
  Object.values(appState.data.cameras).forEach(camera => {
    if (camera.historico) {
      totalEvents += camera.historico.length;
    }
  });
  
  document.getElementById('stat-events').textContent = totalEvents;
  
  // Render latest events table
  const allEvents = [];
  Object.values(appState.data.cameras).forEach(camera => {
    if (camera.historico && Array.isArray(camera.historico)) {
      allEvents.push(...camera.historico);
    }
  });
  
  allEvents.sort((a, b) => new Date(b.timestampEvento) - new Date(a.timestampEvento));
  const latestEvents = allEvents.slice(0, 5);
  
  const tbody = document.querySelector('#dashboard-events-table tbody');
  if (latestEvents.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-message">No hay eventos disponibles</td></tr>';
  } else {
    tbody.innerHTML = latestEvents.map(event => `
      <tr>
        <td>${formatDateTime(event.timestampEvento)}</td>
        <td>${event.idCamara || 'N/A'}</td>
        <td><strong>${event.placa || 'N/A'}</strong></td>
        <td><span class="status ${event.tipoEvento === 'entrada' ? 'status--success' : 'status--warning'}">${event.tipoEvento || 'N/A'}</span></td>
        <td><span class="status ${event.autorizado ? 'status--success' : 'status--error'}">${event.autorizado ? 'Sí' : 'No'}</span></td>
        <td>${event.velocidadKmh ? event.velocidadKmh.toFixed(1) + ' km/h' : 'N/A'}</td>
      </tr>
    `).join('');
  }
  
  // Render activity chart
  renderActivityChart();
}

function renderActivityChart() {
  const ctx = document.getElementById('activity-chart');
  if (!ctx) return;
  
  if (appState.charts.activityChart) {
    appState.charts.activityChart.destroy();
  }
  
  const cameraEvents = Object.values(appState.data.cameras).reduce((sum, camera) => 
    sum + (camera.historico ? camera.historico.length : 0), 0);
  const envEvents = Object.values(appState.data.environmental).reduce((sum, station) => 
    sum + (station.historico ? station.historico.length : 0), 0);
  const energyEvents = Object.values(appState.data.energy).reduce((sum, monitor) => 
    sum + (monitor.historico ? monitor.historico.length : 0), 0);
  
  appState.charts.activityChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Cámaras LPR', 'Monitor Ambiental', 'Monitor Energía'],
      datasets: [{
        label: 'Eventos Registrados',
        data: [cameraEvents, envEvents, energyEvents],
        backgroundColor: ['#1FB8CD', '#FFC185', '#B4413C']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function renderCameraView() {
  const cameraId = appState.currentCamera;
  const cameraData = appState.data.cameras[cameraId];
  
  // Render current data
  const currentDataDiv = document.getElementById('camera-current-data');
  const currentData = cameraData.actual || null;

  if (!currentData) {
    currentDataDiv.innerHTML = '<div class="loading-message">No hay datos actuales disponibles</div>';
  } else {
    // Campos y orden típico de LPR
    const orderedKeys = [
      "placa", "autorizado", "ocupacion", "velocidadKmh", "tipoEvento", "ubicacion", "idCamara", "timestampEvento"
    ];
    const labels = {
      "placa": "Placa",
      "autorizado": "Autorizado",
      "ocupacion": "Ocupación",
      "velocidadKmh": "Velocidad",
      "tipoEvento": "Tipo Evento",
      "ubicacion": "Ubicación",
      "idCamara": "ID Cámara",
      "timestampEvento": "Fecha/Hora"
    };
    const fields = orderedKeys.filter(key => key in currentData);

    const dataItems = fields.map(key => {
      let value = currentData[key];
      if (key === "velocidadKmh" && typeof value === 'number') {
        value = value.toFixed(1) + " km/h";
      }
      if (key === "timestampEvento") {
        value = formatDateTime(value);
      }
      if (key === "autorizado") {
        value = `<span class="status ${value ? 'status--success' : 'status--error'}">${value ? "Sí" : "No"}</span>`;
      }
      if (key === "ocupacion") {
        value = `<span class="status ${value ? 'status--warning' : 'status--success'}">${value ? "Ocupado" : "Libre"}</span>`;
      }
      return `
        <div class="data-item">
          <div class="data-item-label">${labels[key] || key}</div>
          <div class="data-item-value">${value}</div>
        </div>
      `;
    }).join('');
    currentDataDiv.innerHTML = dataItems || '<div class="loading-message">No hay datos disponibles</div>';
  }
  
  // Render charts
  renderCameraSpeedChart(cameraId);
  renderCameraEventsChart(cameraId);
  
  // Render history table
  renderCameraHistoryTable(cameraId);
}

function renderCameraSpeedChart(cameraId) {
  const ctx = document.getElementById('camera-speed-chart');
  if (!ctx) return;
  
  if (appState.charts.cameraSpeedChart) {
    appState.charts.cameraSpeedChart.destroy();
  }
  
  const historico = appState.data.cameras[cameraId].historico || [];
  const sortedData = [...historico].sort((a, b) => new Date(a.timestampEvento) - new Date(b.timestampEvento));
  const last20 = sortedData.slice(-20);
  
  appState.charts.cameraSpeedChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last20.map(d => formatDateTime(d.timestampEvento)),
      datasets: [{
        label: 'Velocidad (km/h)',
        data: last20.map(d => d.velocidadKmh || 0),
        borderColor: '#1FB8CD',
        backgroundColor: 'rgba(31, 184, 205, 0.1)',
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          display: false
        },
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function renderCameraEventsChart(cameraId) {
  const ctx = document.getElementById('camera-events-chart');
  if (!ctx) return;
  
  if (appState.charts.cameraEventsChart) {
    appState.charts.cameraEventsChart.destroy();
  }
  
  const historico = appState.data.cameras[cameraId].historico || [];
  const entradas = historico.filter(e => e.tipoEvento === 'entrada').length;
  const salidas = historico.filter(e => e.tipoEvento === 'salida').length;
  
  appState.charts.cameraEventsChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Entradas', 'Salidas'],
      datasets: [{
        data: [entradas, salidas],
        backgroundColor: ['#1FB8CD', '#FFC185']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

function renderCameraHistoryTable(cameraId) {
  const tbody = document.querySelector('#camera-history-table tbody');
  const historico = appState.data.cameras[cameraId].historico || [];
  let maxRows = appState.data.cameras[cameraId].maxRows || 20;

  // Aplica filtro si lo hay
  const eventTypeFilter = document.getElementById('event-type-filter').value;
  const authFilter = document.getElementById('auth-filter').value;

  let filteredData = [...historico];
  if (eventTypeFilter) {
    filteredData = filteredData.filter(e => e.tipoEvento === eventTypeFilter);
  }
  if (authFilter !== '') {
    filteredData = filteredData.filter(e => e.autorizado.toString() === authFilter);
  }

  filteredData.sort((a, b) => new Date(b.timestampEvento) - new Date(a.timestampEvento));
  const displayedData = filteredData.slice(0, maxRows);

  if (displayedData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-message">No hay datos históricos disponibles</td></tr>';
  } else {
    tbody.innerHTML = displayedData.map(event => `
      <tr>
        <td>${formatDateTime(event.timestampEvento)}</td>
        <td><strong>${event.placa || 'N/A'}</strong></td>
        <td><span class="status ${event.tipoEvento === 'entrada' ? 'status--success' : 'status--warning'}">${event.tipoEvento || 'N/A'}</span></td>
        <td><span class="status ${event.autorizado ? 'status--success' : 'status--error'}">${event.autorizado ? 'Sí' : 'No'}</span></td>
        <td><span class="status ${event.ocupacion ? 'status--warning' : 'status--success'}">${event.ocupacion ? 'Ocupado' : 'Libre'}</span></td>
        <td>${event.velocidadKmh ? event.velocidadKmh.toFixed(1) : 'N/A'}</td>
        <td>${event.ubicacion || 'N/A'}</td>
      </tr>
    `).join('');
  }

  // Si hay más, agrega botón "Ver más"
  if (filteredData.length > maxRows) {
    tbody.innerHTML += `
      <tr><td colspan="7" style="text-align:center;">
        <button id="show-more-history" class="btn btn--primary btn--sm">Ver más</button>
      </td></tr>
    `;
    document.getElementById('show-more-history').onclick = () => {
      appState.data.cameras[cameraId].maxRows = maxRows + 20; // Suma 20 más cada vez
      renderCameraHistoryTable(cameraId);
    };
  }
}

function renderEnvironmentalView() {
  const stationId = appState.currentStation;
  const stationData = appState.data.environmental[stationId];
  const currentData = stationData.actual || null;
  const currentDataDiv = document.getElementById('environmental-current-data');

  if (!currentData) {
    currentDataDiv.innerHTML = '<div class="loading-message">No hay datos actuales disponibles</div>';
    return;
  }

  // Puedes agrupar datos y ponerles un color o ícono
  const dataVisual = [
    {
      label: "Temperatura",
      icon: "🌡️",
      value: currentData.temperaturaC ? `${currentData.temperaturaC.toFixed(2)} °C` : "N/A",
      color: "#e76f51"
    },
    {
      label: "Humedad Relativa",
      icon: "💧",
      value: currentData.humedadRel ? `${currentData.humedadRel.toFixed(2)} %` : "N/A",
      color: "#2a9d8f"
    },
    {
      label: "CO₂",
      icon: "🟢",
      value: currentData.co2 ? `${currentData.co2.toFixed(2)} ppm` : "N/A",
      color: "#264653"
    },
    {
      label: "PM10",
      icon: "🌪️",
      value: currentData.pm10 ? `${currentData.pm10.toFixed(2)} µg/m³` : "N/A",
      color: "#1fb8cd"
    },
    {
      label: "PM2.5",
      icon: "🌫️",
      value: currentData.pm25 ? `${currentData.pm25.toFixed(2)} µg/m³` : "N/A",
      color: "#f4a261"
    },
    {
      label: "Ubicación",
      icon: "📍",
      value: currentData.ubicacion || "N/A",
      color: "#756bb1"
    },
    {
      label: "Fecha/Hora",
      icon: "🕒",
      value: formatDateTime(currentData.timestamp),
      color: "#3c3c3c"
    },
    {
      label: "ID Estación",
      icon: "🔖",
      value: currentData.id || "N/A",
      color: "#4c6ef5"
    }
  ];
  

  // Render como grid visual
  currentDataDiv.innerHTML = dataVisual.map(item => `
    <div class="data-item" style="border-left: 4px solid ${item.color}; padding-left: 10px;">
      <div class="data-item-label" style="display: flex; align-items: center;">
        <span style="font-size: 1.3em; margin-right: 6px;">${item.icon}</span>
        ${item.label}
      </div>
      <div class="data-item-value" style="font-weight: bold; color: ${item.color};">
        ${item.value}
      </div>
    </div>
  `).join('');
  
  // Render charts
  renderEnvironmentalCharts(stationId);
  
  // Render history table
  renderEnvironmentalHistoryTable(stationId);
}

function renderEnvironmentalCharts(stationId) {
  const historico = appState.data.environmental[stationId].historico || [];
  const sortedData = [...historico].sort((a, b) => new Date(a.timestampEvento) - new Date(b.timestampEvento));
  const last20 = sortedData.slice(-20);
  
  // Temperature chart
  const tempCtx = document.getElementById('environmental-temp-chart');
  if (tempCtx) {
    if (appState.charts.envTempChart) {
      appState.charts.envTempChart.destroy();
    }
    
    const tempData = last20.map(d => d.temperaturaC || d.temperatura || d.temp || null).filter(t => t !== null);

    appState.charts.envTempChart = new Chart(tempCtx, {
      type: 'line',
      data: {
        labels: last20.map(d => formatDateTime(d.timestampEvento)),
        datasets: [{
          label: 'Temperatura (°C)',
          data: tempData.length > 0 ? tempData : [0],
          borderColor: '#B4413C',
          backgroundColor: 'rgba(180, 65, 60, 0.1)',
          tension: 0.3,
          tooltip: { callbacks: { label: ctx => `Temp: ${ctx.parsed.y.toFixed(2)} °C` } }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            display: false
          },
          y: {
            beginAtZero: false
          }
        }
      }
    });
  }
  
  // Humidity chart
  const humidityCtx = document.getElementById('environmental-humidity-chart');
  if (humidityCtx) {
    if (appState.charts.envHumidityChart) {
      appState.charts.envHumidityChart.destroy();
    }
    
    const humidityData = last20.map(d => d.humedadRel || d.humedad || d.humidity || null).filter(h => h !== null);
    
    appState.charts.envHumidityChart = new Chart(humidityCtx, {
      type: 'line',
      data: {
        labels: last20.map(d => formatDateTime(d.timestampEvento)),
        datasets: [{
          label: 'Humedad (%)',
          data: humidityData.length > 0 ? humidityData : [0],
          borderColor: '#1FB8CD',
          backgroundColor: 'rgba(31, 184, 205, 0.1)',
          tension: 0.3,
          tooltip: { callbacks: { label: ctx => `Humedad: ${ctx.parsed.y.toFixed(2)} %` } }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            display: false
          },
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    });
  }
}

function renderEnvironmentalHistoryTable(stationId) {
  const tbody = document.querySelector('#environmental-history-table tbody');
  const historico = appState.data.environmental[stationId].historico || [];
  let maxRows = appState.data.environmental[stationId].maxRows || 20;
  
  const sortedData = [...historico].sort((a, b) => new Date(b.timestampEvento) - new Date(a.timestampEvento));
  
  if (sortedData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="loading-message">No hay datos históricos disponibles</td></tr>';
  } else {
    tbody.innerHTML = sortedData.map(data => {
      const dataStr = Object.keys(data)
        .filter(key => key !== 'timestampEvento' && key !== 'idEstacion')
        .map(key => `${key}: ${typeof data[key] === 'number' ? data[key].toFixed(2) : data[key]}`)
        .join(', ');
      
      return `
        <tr>
          <td>${formatDateTime(data.timestampEvento)}</td>
          <td>${dataStr || 'N/A'}</td>
        </tr>
      `;
    }).join('');
  }
}

function renderEnergyView() {
  const monitorId = appState.currentMonitor;
  const monitorData = appState.data.energy[monitorId];
  
  // Render current data
  const currentDataDiv = document.getElementById('energy-current-data');
  const currentData = monitorData.actual || null;

  if (!currentData) {
    currentDataDiv.innerHTML = '<div class="loading-message">No hay datos actuales disponibles</div>';
  } else {
    // Ordena los campos como prefieras
    const orderedKeys = [
      "energiaKWh", "potenciaKW", "corrienteA", "voltajeV", "ubicacion", "estacionId", "timestamp"
    ];
    const fields = orderedKeys.filter(key => key in currentData);

    const labels = {
      "energiaKWh": "Energía (kWh)",
      "potenciaKW": "Potencia (kW)",
      "corrienteA": "Corriente (A)",
      "voltajeV": "Voltaje (V)",
      "ubicacion": "Ubicación",
      "estacionId": "ID Estación",
      "timestamp": "Fecha/Hora"
    };

    const dataItems = fields.map(key => {
      let value = currentData[key];
      if (typeof value === 'number') {
        value = value.toFixed(2);
      }
      return `
        <div class="data-item">
          <div class="data-item-label">${labels[key] || key}</div>
          <div class="data-item-value">${value}</div>
        </div>
      `;
    }).join('');
    currentDataDiv.innerHTML = dataItems || '<div class="loading-message">No hay datos disponibles</div>';
  }
  
  // Render chart
  renderEnergyConsumptionChart(monitorId);
  
  // Render history table
  renderEnergyHistoryTable(monitorId);
}

function renderEnergyConsumptionChart(monitorId) {
  const ctx = document.getElementById('energy-consumption-chart');
  if (!ctx) return;

  if (appState.charts.energyChart) {
    appState.charts.energyChart.destroy();
  }

  const historico = appState.data.energy[monitorId].historico || [];
  const sortedData = [...historico].sort((a, b) => new Date(a.timestampEvento) - new Date(b.timestampEvento));
  const last20 = sortedData.slice(-20);

  // Identificar qué campo usar y la unidad
  let unit = 'kWh'; // por defecto, puedes adaptar a kW, W, etc
  let consumoData = last20.map(d => {
    if (d.energiaKWh !== undefined) { unit = 'kWh'; return d.energiaKWh; }
    if (d.potenciaKW !== undefined) { unit = 'kW'; return d.potenciaKW; }
    if (d.potencia !== undefined)   { unit = 'W';  return d.potencia; }
    if (d.consumo !== undefined)    { unit = 'W';  return d.consumo; }
    return null;
  }).filter(c => c !== null);

  appState.charts.energyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: last20.map(d => formatDateTime(d.timestampEvento)),
      datasets: [{
        label: `Consumo (${unit})`, // aquí sale la unidad en la leyenda
        data: consumoData.length > 0 ? consumoData : [0],
        borderColor: '#FFC185',
        backgroundColor: 'rgba(255, 193, 133, 0.2)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              // Valor con unidad y dos decimales
              return `Consumo: ${context.parsed.y.toFixed(2)} ${unit}`;
            }
          }
        }
      },
      scales: {
        x: { display: false },
        y: { 
          beginAtZero: true,
          title: {
            display: true,
            text: unit,
          }
        }
      }
    }
  });
}

function renderEnergyHistoryTable(monitorId) {
  const tbody = document.querySelector('#energy-history-table tbody');
  const historico = appState.data.energy[monitorId].historico || [];
  
  const sortedData = [...historico].sort((a, b) => new Date(b.timestampEvento) - new Date(a.timestampEvento));
  
  if (sortedData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="loading-message">No hay datos históricos disponibles</td></tr>';
  } else {
    tbody.innerHTML = sortedData.map(data => {
      const dataStr = Object.keys(data)
        .filter(key => key !== 'timestampEvento' && key !== 'idMonitor')
        .map(key => `${key}: ${typeof data[key] === 'number' ? data[key].toFixed(2) : data[key]}`)
        .join(', ');
      
      return `
        <tr>
          <td>${formatDateTime(data.timestampEvento)}</td>
          <td>${dataStr || 'N/A'}</td>
        </tr>
      `;
    }).join('');
  }
}

function renderDevicesView() {
  const tbody = document.querySelector('#devices-table tbody');
  const devices = appState.data.devices;
  
  if (!devices || devices.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading-message">No hay dispositivos disponibles</td></tr>';
  } else {
    tbody.innerHTML = devices.map(device => {
      const deviceInfo = Object.keys(device)
        .filter(key => key !== 'id' && key !== 'tipo' && key !== 'estado')
        .map(key => `${key}: ${device[key]}`)
        .join(', ');
      
      return `
        <tr>
          <td><strong>${device.id || device.idDispositivo || 'N/A'}</strong></td>
          <td>${device.tipo || device.type || 'N/A'}</td>
          <td><span class="status ${device.estado === 'activo' ? 'status--success' : 'status--error'}">${device.estado || 'Desconocido'}</span></td>
          <td>${deviceInfo || 'N/A'}</td>
        </tr>
      `;
    }).join('');
  }
}

// Navigation
function switchView(viewName) {
  // Update active view
  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(`${viewName}-view`).classList.add('active');
  
  // Update navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
  
  // Update title
  const titles = {
    dashboard: 'Vista General',
    cameras: 'Cámaras LPR',
    environmental: 'Monitores Ambientales',
    energy: 'Monitores de Energía',
    devices: 'Lista de Dispositivos'
  };
  document.getElementById('view-title').textContent = titles[viewName];
  
  appState.currentView = viewName;
  
  // Render view
  switch (viewName) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'cameras':
      renderCameraView();
      break;
    case 'environmental':
      renderEnvironmentalView();
      break;
    case 'energy':
      renderEnergyView();
      break;
    case 'devices':
      renderDevicesView();
      break;
  }
}

// Event listeners
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.getAttribute('data-view');
      switchView(view);
    });
  });
  
  // Refresh button
  document.getElementById('refresh-btn').addEventListener('click', () => {
    loadAllData();
  });
  
  // Camera tabs
  document.querySelectorAll('#cameras-view .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#cameras-view .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      appState.currentCamera = tab.getAttribute('data-camera');
      renderCameraView();
    });
  });
  
  // Environmental tabs
  document.querySelectorAll('#environmental-view .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#environmental-view .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      appState.currentStation = tab.getAttribute('data-station');
      renderEnvironmentalView();
    });
  });
  
  // Energy tabs
  document.querySelectorAll('#energy-view .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#energy-view .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      appState.currentMonitor = tab.getAttribute('data-monitor');
      renderEnergyView();
    });
  });
  
  // Camera filters
  document.getElementById('event-type-filter').addEventListener('change', () => {
    renderCameraHistoryTable(appState.currentCamera);
  });
  
  document.getElementById('auth-filter').addEventListener('change', () => {
    renderCameraHistoryTable(appState.currentCamera);
  });
  
  // Device search
  document.getElementById('device-search').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const tbody = document.querySelector('#devices-table tbody');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
  });
}

// Auto-refresh
function startAutoRefresh() {
  if (appState.refreshTimer) {
    clearInterval(appState.refreshTimer);
  }
  
  appState.refreshTimer = setInterval(() => {
    if (appState.autoRefresh) {
      loadAllData();
    }
  }, REFRESH_INTERVAL);
}

// Initialize
function init() {
  updateCurrentDateTime();
  setInterval(updateCurrentDateTime, 1000);
  
  setupEventListeners();
  loadAllData();
  startAutoRefresh();
}

// Start the application
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

module.exports = {
  projectId: "xkrdrz",
  
}
