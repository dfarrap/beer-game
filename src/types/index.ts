export type Role = 'retailer' | 'wholesaler' | 'distributor' | 'factory'

export type SessionStatus = 'lobby' | 'running' | 'finished'

export type RoundAdvanceMode = 'automatic' | 'manual'

export interface GameConfig {
  initialInventory: number
  orderDelay: number
  shippingDelay: number
  inventoryCost: number
  backorderCost: number
  totalRounds: number
  demandPattern: number[]
}

export interface Session {
  id: string
  code: string
  host_id: string
  status: SessionStatus
  config: GameConfig
  current_round: number
  round_advance_mode: RoundAdvanceMode
  created_at: string
}

export interface Team {
  id: string
  session_id: string
  name: string
}

export interface Player {
  id: string
  team_id: string
  session_id: string
  name: string
  role: Role
  connected: boolean
}

export interface RoundState {
  id: string
  team_id: string
  round: number
  role: Role
  inventory: number
  backorder: number
  incoming_shipment: number
  incoming_order: number
  shipped: number
  order_placed: number | null
  order_pipeline: number[]
  shipment_pipeline: number[]
  cost_this_round: number
  cumulative_cost: number
}