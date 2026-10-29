import { Coins, DoorOpen, Fan, Gauge, GraduationCap, Hash, KeyRound, Lock, Medal, Tag } from 'lucide-react'

export type BadgeShape = 'circle' | 'hexagon' | 'shield' | 'star' | 'diamond' | 'octagon' | 'drop' | 'burst' | 'pentagon' | 'crest'

export interface BossBadge {
  /** Same id as the boss that awards it. */
  id: number
  name: string
  shape: BadgeShape
  icon: typeof DoorOpen
  /** What beating the boss proved. */
  skill: string
}

// One badge per boss, like gym badges: a shape, a colour from the boss, and an icon from its mission.
export const bossBadges: BossBadge[] = [
  { id: 1, name: 'Gate Badge', shape: 'circle', icon: DoorOpen, skill: 'Finished an if / else' },
  { id: 2, name: 'Breeze Badge', shape: 'hexagon', icon: Fan, skill: 'Wrote both branches' },
  { id: 3, name: 'Vault Badge', shape: 'shield', icon: Lock, skill: 'Added else on your own' },
  { id: 4, name: 'Coin Badge', shape: 'star', icon: Coins, skill: 'Compared two variables' },
  { id: 5, name: 'Twin Badge', shape: 'diamond', icon: Hash, skill: 'Used % to test even and odd' },
  { id: 6, name: 'Hydra Badge', shape: 'octagon', icon: KeyRound, skill: 'Compared text exactly' },
  { id: 7, name: 'Speed Badge', shape: 'drop', icon: Gauge, skill: 'Nested a decision in else' },
  { id: 8, name: 'Podium Badge', shape: 'burst', icon: Medal, skill: 'Put the hardest question first' },
  { id: 9, name: 'Bargain Badge', shape: 'pentagon', icon: Tag, skill: 'Printed a calculation' },
  { id: 10, name: 'Scholar Badge', shape: 'crest', icon: GraduationCap, skill: 'Built a four-way decision' },
]
