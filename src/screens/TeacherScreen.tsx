import { Activity, Database, Eye, Radio, Users } from 'lucide-react'
import type { AppRoute } from '../types'

interface TeacherScreenProps {
  onNavigate: (route: AppRoute) => void
}

export function TeacherScreen({ onNavigate }: TeacherScreenProps) {
  return (
    <main className="app-page teacher-screen">
      <section className="page-heading">
        <div>
          <p className="kicker">PRIVATE CHANNEL // TEACHER</p>
          <h1>Teacher <em>Mode</em></h1>
          <p>The monitoring architecture is ready. Classroom data appears after the private roster seed is applied.</p>
        </div>
        <Eye className="page-heading__icon" />
      </section>

      <section className="teacher-status">
        <div><Database size={19} /><span><small>DATABASE</small><strong>Migration ready</strong></span><i className="status-amber" /></div>
        <div><Users size={19} /><span><small>ROSTER</small><strong>Private seed required</strong></span><i className="status-amber" /></div>
        <div><Radio size={19} /><span><small>LIVE VIEW</small><strong>Waiting for class activity</strong></span><i /></div>
      </section>

      <section className="teacher-empty">
        <span><Activity size={30} /></span>
        <h2>Signals will appear here.</h2>
        <p>This view will show progress, last activity, hints, attempts, and students who may need attention — without public negative labels.</p>
        <button className="primary-button" onClick={() => onNavigate('dino-lab')}>OPEN TEST LAB</button>
      </section>
    </main>
  )
}
