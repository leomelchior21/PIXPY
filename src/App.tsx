import { lazy, Suspense, useEffect, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { PrintProgress } from './components/PrintProgress'
import { activityIds, type AppRoute, type SessionProgress } from './types'
import { clearSession, createSession, loadSession, restoreProgress, saveSession } from './session/progressSession'
import { flushClassroomProgress, loginToClassroom, onProgressSaved, saveClassroomProgress } from './lib/classroomCloud'
import { NameEntryScreen } from './screens/NameEntryScreen'
import { PlaygroundHome } from './screens/PlaygroundHome'
import { TeacherDashboard } from './screens/TeacherDashboard'
import { VariablesHome } from './screens/VariablesHome'
import { ConditionsHome } from './screens/ConditionsHome'
import { ExtrasHome } from './screens/ExtrasHome'
import { IfElseBuilder } from './experiences/conditions/IfElseBuilder'
import { ChoiceMachine } from './experiences/conditions/ChoiceMachine'
import { isConditionActivity, conditionLock } from './data/conditions'

const DinoVariables = lazy(() => import('./experiences/variables/DinoVariables').then((module) => ({ default: module.DinoVariables })))
const PrintPlayground = lazy(() => import('./experiences/variables/PrintPlayground').then((module) => ({ default: module.PrintPlayground })))
const BlackBox = lazy(() => import('./experiences/variables/BlackBox').then((module) => ({ default: module.BlackBox })))
const InputMachine = lazy(() => import('./experiences/variables/InputMachine').then((module) => ({ default: module.InputMachine })))
const MemoryMachine = lazy(() => import('./experiences/variables/MemoryMachine').then((module) => ({ default: module.MemoryMachine })))
const FinalBosses = lazy(() => import('./experiences/variables/FinalBosses').then((module) => ({ default: module.FinalBosses })))
const BackroomRun = lazy(() => import('./experiences/conditions/BackroomRun').then((module) => ({ default: module.BackroomRun })))
const RepairShop = lazy(() => import('./experiences/conditions/RepairShop').then((module) => ({ default: module.RepairShop })))
const MoreChoices = lazy(() => import('./experiences/conditions/MoreChoices').then((module) => ({ default: module.MoreChoices })))
const BossArena = lazy(() => import('./experiences/conditions/BossArena').then((module) => ({ default: module.BossArena })))
const StopStringSheet = lazy(() => import('./experiences/extras/StopStringSheet').then((module) => ({ default: module.StopStringSheet })))

const validRoutes: AppRoute[] = ['home', 'teacher', 'variables', 'conditionals', 'extras', ...activityIds]

function routeFromHash(): AppRoute {
  const candidate = window.location.hash.replace(/^#\/?/, '') as AppRoute
  return validRoutes.includes(candidate) ? candidate : 'home'
}

export default function App() {
  const [progress, setProgress] = useState<SessionProgress | null>(() => loadSession())
  const [route, setRoute] = useState<AppRoute>(routeFromHash)
  const [syncState, setSyncState] = useState<'saved' | 'saving' | 'offline'>('saved')

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // A retry that lands after the cloud was unreachable clears the offline badge.
  useEffect(() => onProgressSaved(() => setSyncState('saved')), [])

  useEffect(() => {
    if (!progress) return
    saveSession(progress)
    if (progress.isTeacher) return
    setSyncState('saving')
    let active = true
    void saveClassroomProgress(progress)
      .then(() => { if (active) setSyncState('saved') })
      .catch(() => { if (active) setSyncState('offline') })
    return () => { active = false }
  }, [progress])

  const navigate = (next: AppRoute) => {
    setRoute(next)
    if (route !== next) window.history.pushState(null, '', `#/${next}`)
  }

  const start = async (username: string) => {
    const login = await loginToClassroom(username)
    const next = login.isTeacher
      ? createSession(login.displayName, login.username, true)
      : restoreProgress(login.username, login.displayName, login.progress)
    setProgress(next)
    navigate(login.isTeacher ? 'teacher' : 'home')
  }

  const logout = () => {
    void flushClassroomProgress().catch(() => undefined)
    clearSession()
    setProgress(null)
    setSyncState('saved')
    navigate('home')
  }

  if (!progress) return <NameEntryScreen onStart={start} />
  const experienceProps = { progress, onProgress: setProgress, onBack: () => navigate('variables') }
  const visibleRoute = route === 'teacher' && !progress.isTeacher ? 'home' : isConditionActivity(route) && conditionLock(route, progress) !== 'open' ? 'conditionals' : route

  return (
    <div className={`app-shell route-${visibleRoute}`}>
      <AppHeader route={visibleRoute} progress={progress} syncState={syncState} onNavigate={navigate} onLogout={logout} />
      <div className="app-content">
        <Suspense fallback={<div className="route-loader" role="status"><span /> Loading experiment...</div>}>
          {visibleRoute === 'teacher' && progress.isTeacher && <TeacherDashboard username={progress.username} />}
          {visibleRoute === 'home' && <PlaygroundHome progress={progress} onNavigate={navigate} />}
          {visibleRoute === 'variables' && <VariablesHome progress={progress} onNavigate={navigate} />}
          {visibleRoute === 'conditionals' && <ConditionsHome progress={progress} onNavigate={navigate} />}
          {visibleRoute === 'extras' && <ExtrasHome progress={progress} onNavigate={navigate} />}
          {visibleRoute === 'dino-variables' && <DinoVariables {...experienceProps} />}
          {visibleRoute === 'print-playground' && <PrintPlayground {...experienceProps} />}
          {visibleRoute === 'black-box' && <BlackBox {...experienceProps} onNext={() => navigate('memory-machine')} />}
          {visibleRoute === 'input-machine' && <InputMachine {...experienceProps} onNext={() => navigate('final-bosses')} />}
          {visibleRoute === 'memory-machine' && <MemoryMachine {...experienceProps} />}
          {visibleRoute === 'final-bosses' && <FinalBosses {...experienceProps} />}
          {visibleRoute === 'stop' && <StopStringSheet progress={progress} onProgress={setProgress} onBack={() => navigate('extras')} />}
          {visibleRoute === 'backroom-run' && <BackroomRun progress={progress} onProgress={setProgress} onBack={() => navigate('conditionals')} />}
          {visibleRoute === 'choice-machine' && <ChoiceMachine progress={progress} onProgress={setProgress} onBack={() => navigate('conditionals')} onNext={navigate} />}
          {visibleRoute === 'if-else' && <IfElseBuilder progress={progress} onProgress={setProgress} onBack={() => navigate('conditionals')} />}
          {visibleRoute === 'make-it-work' && <RepairShop progress={progress} onProgress={setProgress} onBack={() => navigate('conditionals')} />}
          {visibleRoute === 'more-than-one-choice' && <MoreChoices progress={progress} onProgress={setProgress} onBack={() => navigate('conditionals')} />}
          {visibleRoute === 'conditions-final-bosses' && <BossArena progress={progress} onProgress={setProgress} onBack={() => navigate('conditionals')} />}
        </Suspense>
      </div>
      <PrintProgress progress={progress} />
    </div>
  )
}
