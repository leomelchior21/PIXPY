import { Check, MoveDown, Split } from 'lucide-react'
import { ActivityGuide, type GuideSlide } from '../../components/ActivityGuide'

const slides: GuideSlide[] = [
  {
    kicker: 'WELCOME TO THE SORTING TOWER',
    title: 'Drop a value, watch where it lands',
    text: 'Each machine is a tower of if questions. A value falls through it, and every message the program prints is a bin it lands in.',
    art: <div className="mc-tut mc-tut--tower">
      <span className="mc-tut__ball">25</span>
      <div className="mc-tut__gates"><code>if temp &lt; 0:</code><code>else:</code><code className="is-hit">if temp &lt; 100:</code></div>
      <div className="mc-tut__bins"><span>Ice</span><span className="is-hit">Water</span><span>Steam</span></div>
    </div>,
  },
  {
    kicker: 'SEPARATE IFS',
    title: 'Separate ifs ask every question',
    text: 'Three separate ifs are three separate questions. One value can make two of them TRUE, so the machine says two things, or none at all.',
    art: <div className="mc-tut mc-tut--code">
      <pre><code className="is-true">if temp &lt; 0:        <b>TRUE</b></code>{'\n'}<code>    print("Ice")</code>{'\n'}<code className="is-true">if temp &lt; 100:      <b>TRUE</b></code>{'\n'}<code>    print("Water")</code></pre>
      <div className="mc-tut__out"><small>temp = -5</small><b>Ice</b><b>Water</b><em>TWO AT ONCE!</em></div>
    </div>,
  },
  {
    kicker: 'IF / ELSE INSIDE ELSE',
    title: 'Nested decisions take one path',
    text: 'Put the second question inside else. Python only asks it when the first answer was FALSE, so every value gets exactly one message.',
    art: <div className="mc-tut mc-tut--code">
      <pre><code className="is-false">if temp &lt; 0:        <b>FALSE</b></code>{'\n'}<code>    print("Ice")</code>{'\n'}<code className="is-path">else:</code>{'\n'}<code className="is-true">    if temp &lt; 100:  <b>TRUE</b></code>{'\n'}<code className="is-path">        print("Water")</code></pre>
      <div className="mc-tut__out"><small>temp = 25</small><b>Water</b><em className="is-good"><Check size={13} /> ONE ANSWER</em></div>
    </div>,
  },
  {
    kicker: 'THE MAP',
    title: 'The map shows every value at once',
    text: 'The coloured bar under the tower is the map: which message every value gets. Look for holes and places where two colours stack.',
    art: <div className="mc-tut mc-tut--map">
      <div className="mc-tut__bar"><i style={{ flex: 2, background: '#72dcff' }}>Ice</i><i style={{ flex: 5, background: '#5fd38a' }}>Water</i><i style={{ flex: 2, background: '#ff855e' }}>Steam</i></div>
      <div className="mc-tut__scale"><span>-50</span><span>0</span><span>100</span><span>150</span></div>
    </div>,
  },
  {
    kicker: 'YOUR MISSIONS',
    title: 'Hunt, predict, fix and build',
    text: 'Each level gives you a mission: find a value that breaks the machine, predict the bin, fix the order, or build your own three-way decision.',
    art: <div className="mc-tut mc-tut--controls">
      <div className="mc-tut__stepper"><span>-</span><b>25</b><span>+</span></div>
      <span className="mc-tut__drop"><MoveDown size={15} /> DROP</span>
      <span className="mc-tut__build"><Split size={15} /> if / else</span>
    </div>,
  },
]

export function MoreChoicesGuide({ onClose }: { onClose: () => void }) {
  return <ActivityGuide slides={slides} finish={<>START SORTING <MoveDown size={16} /></>} onClose={onClose} />
}
