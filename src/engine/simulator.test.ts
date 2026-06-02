import { advanceRound, createInitialStates, DEFAULT_CONFIG } from './simulator'

const TEAM_ID = 'test-team'

function simulateGame(rounds: number) {
  const config = DEFAULT_CONFIG
  let states = createInitialStates(TEAM_ID, config) as any[]

  for (let round = 1; round <= rounds; round++) {
    const orders = {
      retailer: 4,
      wholesaler: 4,
      distributor: 4,
      factory: 4,
    }
    states = advanceRound(states as any, orders, round, config) as any[]
  }

  return states
}

const finalStates = simulateGame(10)

console.log('\n=== Resultado después de 10 rondas (pedidos fijos = 4) ===')
finalStates.forEach(s => {
  console.log(`${s.role.padEnd(12)} | inv: ${s.inventory} | backorder: ${s.backorder} | costo acum: $${s.cumulative_cost.toFixed(2)}`)
})