// cypress/e2e/dashboard.cy.js
describe('Dashboard IoT', () => {
  it('Carga vista principal', () => {
    cy.visit('index.html')  // Cambia la ruta si usas un servidor local/puerto
    cy.contains('Vista General').should('exist')
  })
})