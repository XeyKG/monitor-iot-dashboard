/// <reference types="cypress" />

const API_BASE_URL = 'http://20.246.73.238:5051/api';

const cameraActual = {
  placa: 'ABC1234',
  autorizado: true,
  ocupacion: false,
  velocidadKmh: 42.7,
  tipoEvento: 'entrada',
  ubicacion: 'Entrada Principal',
  idCamara: 'LPR1',
  timestampEvento: '2024-08-01T12:05:00Z'
};

const cameraHistory = [
  {
    timestampEvento: '2024-08-01T12:30:00Z',
    placa: 'TEST-12',
    tipoEvento: 'entrada',
    autorizado: true,
    ocupacion: false,
    velocidadKmh: 40.1,
    ubicacion: 'Entrada Principal',
    idCamara: 'LPR1'
  },
  {
    timestampEvento: '2024-08-01T11:40:00Z',
    placa: 'TEST-34',
    tipoEvento: 'salida',
    autorizado: false,
    ocupacion: true,
    velocidadKmh: 35.8,
    ubicacion: 'Salida Norte',
    idCamara: 'LPR2'
  },
  {
    timestampEvento: '2024-08-01T11:05:00Z',
    placa: 'TEST-56',
    tipoEvento: 'entrada',
    autorizado: true,
    ocupacion: true,
    velocidadKmh: 28.4,
    ubicacion: 'Acceso VIP',
    idCamara: 'LPR3'
  }
];

const envActual = {
  temperaturaC: 23.4,
  humedadRel: 52.3,
  co2: 390.1,
  pm10: 18.5,
  pm25: 9.4,
  ubicacion: 'Sala de Control',
  timestamp: '2024-08-01T11:45:00Z',
  id: 'EST1'
};

const envHistory = [
  {
    timestampEvento: '2024-08-01T11:40:00Z',
    temperaturaC: 22.8,
    humedadRel: 51.8,
    idEstacion: 'EST1'
  },
  {
    timestampEvento: '2024-08-01T10:15:00Z',
    temperaturaC: 23.9,
    humedadRel: 54.0,
    idEstacion: 'EST1'
  },
  {
    timestampEvento: '2024-08-01T09:30:00Z',
    temperaturaC: 24.1,
    humedadRel: 55.4,
    idEstacion: 'EST1'
  }
];

const energyActual = {
  energiaKWh: 12.45,
  potenciaKW: 3.2,
  corrienteA: 11.8,
  voltajeV: 229.6,
  ubicacion: 'Centro de Datos',
  estacionId: 'EV-001',
  timestamp: '2024-08-01T11:28:00Z'
};

const energyHistory = [
  {
    timestampEvento: '2024-08-01T11:15:00Z',
    energiaKWh: 11.2,
    potenciaKW: 2.9,
    idMonitor: 'EV-001'
  },
  {
    timestampEvento: '2024-08-01T10:45:00Z',
    energiaKWh: 10.9,
    potenciaKW: 2.7,
    idMonitor: 'EV-001'
  }
];

const devicesList = [
  {
    id: 'dev-01',
    tipo: 'Sensor',
    estado: 'activo',
    nombre: 'Sensor Estacionario',
    ubicacion: 'Lobby',
    version: '1.2.0'
  },
  {
    id: 'dev-02',
    tipo: 'Cámara',
    estado: 'inactivo',
    nombre: 'Cámara Perimetral',
    ubicacion: 'Perímetro Norte'
  }
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const stubApiEndpoints = () => {
  cy.intercept('GET', '**/monitor_acceso_*/actual', (req) => {
    req.reply({ body: clone(cameraActual) });
  });
  cy.intercept('GET', '**/monitor_acceso_*/historico', (req) => {
    req.reply({ body: clone(cameraHistory) });
  }).as('cameraHistory');

  cy.intercept('GET', '**/monitor_ambiental_*/actual', (req) => {
    req.reply({ body: clone(envActual) });
  });
  cy.intercept('GET', '**/monitor_ambiental_*/historico', (req) => {
    req.reply({ body: clone(envHistory) });
  });

  cy.intercept('GET', '**/monitor_energia_*/actual', (req) => {
    req.reply({ body: clone(energyActual) });
  });
  cy.intercept('GET', '**/monitor_energia_*/historico', (req) => {
    req.reply({ body: clone(energyHistory) });
  });

  cy.intercept('GET', '**/dispositivos', (req) => {
    req.reply({ body: clone(devicesList) });
  }).as('loadDevices');
};

describe('monitor-iot-dashboard', () => {
  beforeEach(() => {
    stubApiEndpoints();
    cy.visit('/');
    cy.wait('@loadDevices');
  });

  it('renders dashboard summary and latest events', () => {
    cy.wait('@cameraHistory');

    const totalEvents = cameraHistory.length * 3;
    cy.get('#stat-events').should('have.text', `${totalEvents}`);
    cy.get('#dashboard-events-table tbody tr')
      .first()
      .should('contain.text', cameraHistory[0].placa);
    cy.get('#stat-cameras').should('have.text', '3');
  });

  it('navigates between different views and shows contextual data', () => {
    cy.get('[data-view="cameras"]').click();
    cy.get('#view-title').should('have.text', 'Cámaras LPR');
    cy.get('#camera-current-data').should('contain.text', 'Placa');

    cy.get('[data-view="environmental"]').click();
    cy.get('#view-title').should('have.text', 'Monitores Ambientales');
    cy.get('#environmental-current-data').should('contain.text', 'Temperatura');

    cy.get('[data-view="energy"]').click();
    cy.get('#view-title').should('have.text', 'Monitores de Energía');
    cy.get('#energy-current-data').should('contain.text', 'Energía (kWh)');

    cy.get('[data-view="devices"]').click();
    cy.get('#view-title').should('have.text', 'Lista de Dispositivos');
    cy.get('#devices-table').should('contain.text', 'Sensor Estacionario');
  });

  it('filters camera history by event type and authorization', () => {
    cy.get('[data-view="cameras"]').click();
    cy.get('#event-type-filter').select('entrada');
    cy.get('#camera-history-table tbody tr')
      .each((row) => {
        cy.wrap(row).should('contain.text', 'entrada');
      });

    cy.get('#auth-filter').select('true');
    cy.get('#camera-history-table tbody tr').each((row) => {
      cy.wrap(row).should('contain.text', 'Sí');
    });
  });

  it('searches devices using the quick filter', () => {
    cy.get('[data-view="devices"]').click();
    cy.get('#device-search').type('sensor');
    cy.get('#devices-table tbody tr').filter(':visible').should('have.length', 1);
    cy.get('#devices-table tbody tr').first().should('contain.text', 'dev-01');
  });
});
