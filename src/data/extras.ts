import { Table } from 'lucide-react'
import type { ActivityId } from '../types'

export interface ExtraExperience {
  id: ActivityId
  order: string
  title: string
  description: string
  color: string
  icon: typeof Table
}

export const extraExperiences: ExtraExperience[] = [
  { id: 'stop', order: '01', title: 'STOP · STRING SHEET', description: 'Fill a six-row sheet, one labeled print at a time.', color: '#72dcff', icon: Table },
]
