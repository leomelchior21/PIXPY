import { ArrowRight, BatteryCharging, Bug, Check, CircleHelp, Cookie, DoorClosed, Fan, Gamepad2, Lamp, MousePointerClick, Play, Power, Ruler, Trophy, Wrench, Zap } from 'lucide-react'
import { ActivityGuide, type GuideSlide } from '../../../components/ActivityGuide'

interface Props {
  onClose: () => void
}

const machineIcons = [Gamepad2, DoorClosed, BatteryCharging, Ruler, Fan, Trophy, Lamp, Cookie]

const slides: GuideSlide[] = [
  {
    kicker: 'WELCOME TO THE REPAIR SHOP',
    title: 'Customers bring you broken machines',
    text: 'Every machine runs a tiny Python program with a bug in it. You fix it in five steps.',
    art: <div className="rs-tut-art rs-tut-art--welcome">
      <div className="rs-tut-ticket"><small>REPAIR TICKET #01</small><b>The arcade cabinet</b><p>“I put in exactly 3 coins… but it says Insert more coins!”</p></div>
      <div className="rs-tut-machines">{machineIcons.map((Icon, index) => <span key={index} style={{ animationDelay: `${index * 90}ms` }}><Icon size={20} /></span>)}</div>
    </div>,
  },
  {
    kicker: 'STEP 1 · REPRODUCE',
    title: 'Make the bug happen',
    text: 'Pick the value from the complaint and press RUN. When the machine gets it wrong, you have caught the bug.',
    art: <div className="rs-tut-art rs-tut-art--reproduce">
      <div className="rs-tut-chips"><span>1</span><span className="is-on">3</span><span>5</span></div>
      <span className="rs-tut-run"><Play size={14} fill="currentColor" /> RUN WITH 3</span>
      <ArrowRight className="rs-tut-arrow" size={22} />
      <div className="rs-tut-screen is-wrong"><small>coins = 3</small><b>Insert more coins</b></div>
    </div>,
  },
  {
    kicker: 'STEP 2 · DIAGNOSE',
    title: 'Name the kind of bug',
    text: 'Watch what the machine did, then stamp the bug.',
    art: <div className="rs-tut-art rs-tut-art--diagnose">
      <div className="rs-tut-stamp rs-kind--syntax"><Power size={22} /><b>SYNTAX</b><small>Won’t start. No line runs.</small></div>
      <div className="rs-tut-stamp rs-kind--runtime"><Zap size={22} /><b>RUNTIME</b><small>Starts, then crashes.</small></div>
      <div className="rs-tut-stamp rs-kind--logic"><CircleHelp size={22} /><b>LOGIC</b><small>Runs, but the answer is wrong.</small></div>
    </div>,
  },
  {
    kicker: 'STEP 3 · LOCATE',
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
    kicker: 'STEPS 4 + 5 · FIX AND VERIFY',
    title: 'Swap the part, then test everything',
    text: 'Choose a replacement line and install it. The test bench then tries five values: all five must pass.',
    art: <div className="rs-tut-art rs-tut-art--fix">
      <span className="rs-tut-part"><Wrench size={14} /> if coins &gt;= 3:</span>
      <ArrowRight className="rs-tut-arrow" size={22} />
      <div className="rs-tut-bench">{['0', '2', '3', '4', '10'].map((value, index) => <span key={value} style={{ animationDelay: `${300 + index * 220}ms` }}><b>{value}</b><Check size={12} /></span>)}</div>
    </div>,
  },
]

/** Five cards that explain the repair steps. Opens on the first visit and from the help button. */
export function RepairTutorial({ onClose }: Props) {
  return <ActivityGuide slides={slides} finish={<>START REPAIRING <Wrench size={16} /></>} onClose={onClose} />
}
