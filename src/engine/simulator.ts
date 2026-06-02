import type { GameConfig, Role, RoundState } from '../types/index'

const ROLES: Role[] = ['retailer', 'wholesaler', 'distributor', 'factory']

export const DEFAULT_CONFIG: GameConfig = {
  initialInventory: 12,
  orderDelay: 2,
  shippingDelay: 2,
  inventoryCost: 0.5,
  backorderCost: 1.0,
  totalRounds: 26,
  demandPattern: [
    4,4,4,4,
    8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8
  ],
}

export function createInitialStates(
  teamId: string,
  config: GameConfig
): Omit<RoundState, 'id'>[] {
  return ROLES.map(role => ({
    team_id: teamId,
    round: 0,
    role,
    inventory: config.initialInventory,
    backorder: 0,
    incoming_shipment: 0,
    incoming_order: 0,
    shipped: 0,
    order_placed: null,
    order_pipeline: Array(config.orderDelay).fill(0),
    shipment_pipeline: Array(config.shippingDelay).fill(config.initialInventory / 2),
    cost_this_round: 0,
    cumulative_cost: 0,
  }))
}

export function advanceRound(
  currentStates: RoundState[],
  orders: Record<Role, number>,
  round: number,
  config: GameConfig
): Omit<RoundState, 'id'>[] {
  const stateByRole = Object.fromEntries(
    currentStates.map(s => [s.role, s])
  ) as Record<Role, RoundState>

  const customerDemand = config.demandPattern[round - 1] ?? 4

  return ROLES.map(role => {
    const current = stateByRole[role]
    const shipmentPipeline = [...current.shipment_pipeline]
    const orderPipeline = [...current.order_pipeline]

    // 1. Recibir inventario entrante
    const incomingShipment = shipmentPipeline.shift() ?? 0

    // 2. Recibir pedido entrante
    const incomingOrder = role === 'retailer'
      ? customerDemand
      : orders[ROLES[ROLES.indexOf(role) - 1]]

    // 3. Demanda total
    const totalDemand = incomingOrder + current.backorder

    // 4. Despachar
    const availableInventory = current.inventory + incomingShipment
    const shipped = Math.min(availableInventory, totalDemand)

    // 5. Actualizar backorder
    const newBackorder = totalDemand - shipped

    // 6. Actualizar inventario
    const newInventory = availableInventory - shipped

    // 7. El pedido del jugador ya viene en `orders[role]`
    const orderPlaced = orders[role]

    // 8. El pedido entra a la tubería
    orderPipeline.push(orderPlaced)
    const outgoingOrder = orderPipeline.shift() ?? 0
    shipmentPipeline.push(outgoingOrder)

    // Costos
    const costThisRound =
      newInventory * config.inventoryCost +
      newBackorder * config.backorderCost

    return {
      team_id: current.team_id,
      round,
      role,
      inventory: newInventory,
      backorder: newBackorder,
      incoming_shipment: incomingShipment,
      incoming_order: incomingOrder,
      shipped,
      order_placed: orderPlaced,
      order_pipeline: orderPipeline,
      shipment_pipeline: shipmentPipeline,
      cost_this_round: costThisRound,
      cumulative_cost: current.cumulative_cost + costThisRound,
    }
  })
}