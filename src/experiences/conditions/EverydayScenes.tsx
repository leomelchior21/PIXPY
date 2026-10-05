import { Check, CircleDollarSign, Fan, Footprints, Gamepad2, Hand, LightbulbOff, PlugZap, Radar } from 'lucide-react'
import type { EverydayChoice } from '../../data/choiceMachine'
import './everydayScenes.css'

interface Props {
  id: EverydayChoice['id']
  visual?: EverydayChoice['visual']
  result?: string
  revealed: boolean
}

export function EverydayScene({ id, visual, result, revealed }: Props) {
  if (!visual) return null
  return <div className={`cm-scene cm-scene--everyday cm-scene--${id} ${revealed ? 'is-revealed' : ''}`} role="img" aria-label={visual.description}>
    <div className="cm-everyday-art" aria-hidden="true">
      {id === 'traffic' && <><div className="cm-traffic-signal"><span className="is-red"><Hand /></span><span><Footprints /></span></div><div className="cm-crossing-road"><span /><span /><span /><span /></div></>}
      {id === 'battery' && <div className="cm-scene-phone"><i /><div className="cm-phone-battery"><span style={{ width: `${Math.max(0, Math.min(100, Number.parseFloat(visual.value)))}%` }} /></div><strong>{visual.value}</strong>{revealed && <PlugZap className="cm-phone-charge" size={25} />}<span className="cm-phone-home" /></div>}
      {id === 'ride' && <div className="cm-height-check"><div className="cm-height-person"><span /><i /><b /><b /></div><div className="cm-height-ruler"><span>{visual.rule}</span><i /></div></div>}
      {id === 'arcade' && <><div className="cm-arcade-cabinet"><small>PIX ARCADE</small><div><Gamepad2 size={43} /><i /><i /><i /></div><span className="cm-arcade-controls"><b /><i /><i /></span></div><div className="cm-arcade-coins">{Array.from({ length: Math.max(0, Math.min(5, Number.parseInt(visual.value, 10))) }, (_, index) => <CircleDollarSign key={index} />)}</div></>}
      {id === 'motion' && <div className="cm-empty-hallway"><div className="cm-hallway-door" /><LightbulbOff className="cm-hallway-lamp" size={41} /><span className="cm-hallway-sensor"><Radar size={24} /><i /></span></div>}
      {id === 'temperature' && <><div className="cm-room-thermometer"><small>ROOM</small><strong>{visual.value}</strong><div><i /><span /></div></div><div className="cm-room-fan"><span><Fan /></span><i /><b /></div></>}
    </div>
    <div className="cm-visual-facts" aria-hidden="true"><span><small>{visual.valueLabel}</small><strong>{visual.value}</strong></span><span><small>{visual.ruleLabel}</small><strong>{visual.rule}</strong></span></div>
    {revealed && <span className="cm-scene-response" aria-hidden="true"><Check size={13} />{result}</span>}
  </div>
}
