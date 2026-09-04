interface PersonalMessageRewardProps { greeting: string; message: string }

export function PersonalMessageReward({ greeting, message }: PersonalMessageRewardProps) {
  return (
    <section className="print-reward personal-message-reward" aria-label="Personal message delivery" aria-live="polite" tabIndex={0}>
      <p className="personal-greeting">{greeting}</p>
      <div className="line-two-printer" aria-hidden="true"><i /><i /><i /></div>
      <div className="message-on-board"><span>MESSAGE ON BOARD</span><strong>{message}</strong></div>
      <div className="line-two-burst" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="reward-road" aria-hidden="true"><i /><i /><i /></div>
      <div className="reward-car" aria-hidden="true"><span /><b /><b /></div>
    </section>
  )
}
