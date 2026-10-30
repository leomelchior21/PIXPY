import { ArrowRight, BatteryCharging, Bug, Check, Cookie, DoorClosed, Fan, Gamepad2, Lamp, MousePointerClick, Ruler, Trophy, UserRound, Wrench } from 'lucide-react'
import { ActivityGuide, type GuideSlide } from '../../../components/ActivityGuide'

interface Props {
  onClose: () => void
}

const machineIcons = [Gamepad2, DoorClosed, BatteryCharging, Ruler, Fan, Trophy, Lamp, Cookie]

const slides: GuideSlide[] = [
  {
    kicker: 'WELCOME TO THE REPAIR SHOP',
    title: 'Customers bring you broken machines',
    text: 'Every machine runs a tiny Python program with a bug in it. You fix it in four steps.',
    art: <div className="rs-tut-art rs-tut-art--welcome">
      <div className="rs-tut-ticket"><small>REPAIR TICKET #01</small><b>The arcade cabinet</b><p>“I put in exactly 3 coins… but it says Insert more coins!”</p></div>
      <div className="rs-tut-machines">{machineIcons.map((Icon, index) => <span key={index} style={{ animationDelay: `${index * 90}ms` }}><Icon size={20} /></span>)}</div>
    </div>,
  },
  {
    kicker: 'STEP 1 · WATCH',
    title: 'The customer shows you the problem',
    text: 'Press NEXT and watch: the customer types a value, runs the machine, and you see what goes wrong.',
    art: <div className="rs-tut-art rs-tut-art--reproduce">
      <span className="rs-tut-run"><UserRound size={14} /> “I type 3. Look!”</span>
      <ArrowRight className="rs-tut-arrow" size={22} />
      <div className="rs-tut-screen is-wrong"><small>coins = 3</small><b>Insert more coins</b></div>
    </div>,
  },
  {
    kicker: 'STEP 2 · LOCATE',
    title: 'Tap the broken line',
    text: 'Read the code. Python’s error report often names the line, but the real bug can hide somewhere else.',
    art: <div className="rs-tut-art rs-tut-art--locate">
      <div className="rs-tut-code">
        <code><i>1</i>coins = int(input())</code>
        <code className="is-bug"><i>2</i>if coins &gt; 3:<Bug size={14} /></code>
        <code><i>3</i>    print("Game start!")</code>
        <code><i>4</i>else:</code>
      </div>
      <MousePointerClick className="rs-tut-pointer" size={30} />
    </div>,
  },
  {
    kicker: 'STEPS 3 + 4 · REBUILD AND VERIFY',
    title: 'Rebuild the line, then test everything',
    text: 'Tap the pieces in order to build a new line, then install it. The test bench tries five values: all five must pass.',
    art: <div className="rs-tut-art rs-tut-art--fix">
      <span className="rs-tut-part">{['if', 'coins', '>=', '3', ':'].map((piece) => <i key={piece}>{piece}</i>)}</span>
      <ArrowRight className="rs-tut-arrow" size={22} />
      <div className="rs-tut-bench">{['0', '2', '3', '4', '10'].map((value, index) => <span key={value} style={{ animationDelay: `${300 + index * 220}ms` }}><b>{value}</b><Check size={12} /></span>)}</div>
    </div>,
  },
]

/** Four cards that explain the repair steps. Opens on the first visit and from the help button. */
export function RepairTutorial({ onClose }: Props) {
  return <ActivityGuide slides={slides} finish={<>START REPAIRING <Wrench size={16} /></>} onClose={onClose} />
}
