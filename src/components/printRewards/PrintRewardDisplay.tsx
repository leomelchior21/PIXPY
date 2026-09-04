import type { PrintReward } from '../../lib/printRewards'
import { EmptyLineReward } from './EmptyLineReward'
import { HeartStackReward } from './HeartStackReward'
import { LaunchSequenceReward } from './LaunchSequenceReward'
import { MorningGreetingReward } from './MorningGreetingReward'
import { PersonalMessageReward } from './PersonalMessageReward'
import { TextFrameReward } from './TextFrameReward'

interface PrintRewardDisplayProps { reward: PrintReward }

export function PrintRewardDisplay({ reward }: PrintRewardDisplayProps) {
  if (reward.type === 'morning-greeting') return <MorningGreetingReward message={reward.message} />
  if (reward.type === 'personal-message') return <PersonalMessageReward greeting={reward.greeting} message={reward.message} />
  if (reward.type === 'empty-line') return <EmptyLineReward top={reward.top} bottom={reward.bottom} />
  if (reward.type === 'text-frame') return <TextFrameReward output={reward.output} lines={reward.lines} />
  if (reward.type === 'launch-sequence') return <LaunchSequenceReward countdown={reward.countdown} liftoff={reward.liftoff} />
  return <HeartStackReward output={reward.output} lines={reward.lines} />
}
