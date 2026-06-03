import type { GameConfig, Role, RoundState } from '../types/index'

const ROLES: Role[] = ['retailer', 'wholesaler', 'distributor', 'factory']

export const DEFAULT_CONFIG: GameConfig = {
  initialInventory: 12,
  orderDelay: 2,
  shippingDelay: 2,
  inventoryCost: 0.5,
  backorderCost: 1.0,
  totalRounds: 26,
  initialDemandInTransit: 4,
  historicalDemand: [4, 4],
  demandPattern: [4,4,4,4,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8],
  roundTimeSeconds: 0,
  botsEnabled: false,
}

export function createInitialStates(
  teamId: string,
  config: GameConfig
): Omit<RoundState, 'id'>[] {
  const fallback = config.initialDemandInTransit ?? 4
  const hist = config.historicalDemand?.length
    ? config.historicalDemand
    : Array(Math.max(config.orderDelay, config.shippingDelay)).fill(fallback)

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
    order_pipeline: Array(config.orderDelay).fill(0).map((_, i) => hist[i] ?? fallback),
    shipment_pipeline: Array(config.shippingDelay).fill(0).map((_, i) => hist[i] ?? fallback),
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
  const byRole = Object.fromEntries(
    currentStates.map(s => [s.role, s])
  ) as Record<Role, RoundState>

  const demand = config.demandPattern[round - 1] ?? 4

  // Incoming orders con retraso real (order delay via order_pipeline del eslabón de abajo)
  const incomingOrders: Record<Role, number> = {
    retailer: demand,
    wholesaler: byRole['retailer'].order_pipeline[0] ?? 0,
    distributor: byRole['wholesaler'].order_pipeline[0] ?? 0,
    factory: byRole['distributor'].order_pipeline[0] ?? 0,
  }

  // Incoming shipments desde shipment_pipeline
  // Fábrica: su "envío entrante" es producción completada = order_pipeline[0] propio
  const incomingShipments: Record<Role, number> = {
    retailer: byRole['retailer'].shipment_pipeline[0] ?? 0,
    wholesaler: byRole['wholesaler'].shipment_pipeline[0] ?? 0,
    distributor: byRole['distributor'].shipment_pipeline[0] ?? 0,
    factory: byRole['factory'].order_pipeline[0] ?? 0,
  }

  // Calcular shipped de todos los roles (necesario para llenar pipelines downstream)
  const shippedAmounts: Record<Role, number> = {} as Record<Role, number>
  for (const role of ROLES) {
    const s = byRole[role]
    const totalDemand = incomingOrders[role] + s.backorder
    const available = s.inventory + incomingShipments[role]
    shippedAmounts[role] = Math.min(available, totalDemand)
  }

  return ROLES.map(role => {
    const s = byRole[role]
    const inc = incomingShipments[role]
    const ord = incomingOrders[role]
    const ship = shippedAmounts[role]
    const totalDemand = ord + s.backorder
    const newInventory = s.inventory + inc - ship
    const newBackorder = totalDemand - ship
    const orderPlaced = orders[role]

    // Avanzar order pipeline
    const orderPipeline = [...s.order_pipeline]
    orderPipeline.shift()
    orderPipeline.push(orderPlaced)

    // Avanzar shipment pipeline
    const shipmentPipeline = [...s.shipment_pipeline]
    shipmentPipeline.shift()

    if (role !== 'factory') {
      // Lo que entra al pipeline es lo que el eslabón de arriba despachó este turno
      const upstreamRole = ROLES[ROLES.indexOf(role) + 1] as Role
      shipmentPipeline.push(shippedAmounts[upstreamRole])
    } else {
      // Fábrica no tiene eslabón de arriba; su producción viene del order_pipeline propio
      shipmentPipeline.push(0)
    }

    const costThisRound =
      newInventory * config.inventoryCost +
      newBackorder * config.backorderCost

    return {
      team_id: s.team_id,
      round,
      role,
      inventory: newInventory,
      backorder: newBackorder,
      incoming_shipment: inc,
      incoming_order: ord,
      shipped: ship,
      order_placed: orderPlaced,
      order_pipeline: orderPipeline,
      shipment_pipeline: shipmentPipeline,
      cost_this_round: costThisRound,
      cumulative_cost: s.cumulative_cost + costThisRound,
    }
  })
}
