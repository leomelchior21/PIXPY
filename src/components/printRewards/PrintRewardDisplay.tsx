import type { PrintReward } from '../../lib/printRewards'
import { EmptyLineReward } from './EmptyLineReward'
import { MorningGreetingReward } from './MorningGreetingReward'
import { PersonalMessageReward } from './PersonalMessageReward'
import { TextFrameReward } from './TextFrameReward'

interface PrintRewardDisplayProps { reward: PrintReward }

export function PrintRewardDisplay({ reward }: PrintRewardDisplayProps) {
  if (reward.type === 'morning-greeting') return <MorningGreetingReward message={reward.message} />
  if (reward.type === 'personal-message') return <PersonalMessageReward greeting={reward.greeting} message={reward.message} />
  if (reward.type === 'empty-line') return <EmptyLineReward top={reward.top} bottom={reward.bottom} />
  return <TextFrameReward output={reward.output} lines={reward.lines} />
}
