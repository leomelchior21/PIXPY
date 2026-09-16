import { lazy, Suspense, useEffect, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { PrintProgress } from './components/PrintProgress'
import { activityIds, type AppRoute, type SessionProgress } from './types'
import { clearSession, createSession, loadSession, restoreProgress, saveSession } from './session/progressSession'
import { loginToClassroom, saveClassroomProgress } from './lib/classroomCloud'
import { ComingSoonScreen } from './screens/ComingSoonScreen'
import { NameEntryScreen } from './screens/NameEntryScreen'
import { PlaygroundHome } from './screens/PlaygroundHome'
import { TeacherDashboard } from './screens/TeacherDashboard'
import { VariablesHome } from './screens/VariablesHome'

const DinoVariables = lazy(() => import('./experiences/variables/DinoVariables').then((module) => ({ default: module.DinoVariables })))
const PrintPlayground = lazy(() => import('./experiences/variables/PrintPlayground').then((module) => ({ default: module.PrintPlayground })))
const BlackBox = lazy(() => import('./experiences/variables/BlackBox').then((module) => ({ default: module.BlackBox })))
const InputMachine = lazy(() => import('./experiences/variables/InputMachine').then((module) => ({ default: module.InputMachine })))
const MemoryMachine = lazy(() => import('./experiences/variables/MemoryMachine').then((module) => ({ default: module.MemoryMachine })))
const BuildBlackBox = lazy(() => import('./experiences/variables/BuildBlackBox').then((module) => ({ default: module.BuildBlackBox })))
const FinalBosses = lazy(() => import('./experiences/variables/FinalBosses').then((module) => ({ default: module.FinalBosses })))

const validRoutes: AppRoute[] = ['home', 'variables', 'conditionals', 'functions', ...activityIds]

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
    navigate('home')
  }

  const logout = () => {
    clearSession()
    setProgress(null)
    setSyncState('saved')
    navigate('home')
  }

  if (!progress) return <NameEntryScreen onStart={start} />
  if (progress.isTeacher) return <TeacherDashboard username={progress.username} onLogout={logout} />

  const experienceProps = { progress, onProgress: setProgress, onBack: () => navigate('variables') }

  return (
    <div className={`app-shell route-${route}`}>
      <AppHeader route={route} progress={progress} syncState={syncState} onNavigate={navigate} onLogout={logout} />
      <div className="app-content">
        <Suspense fallback={<div className="route-loader" role="status"><span /> Loading experiment...</div>}>
          {route === 'home' && <PlaygroundHome progress={progress} onNavigate={navigate} />}
          {route === 'variables' && <VariablesHome progress={progress} onNavigate={navigate} />}
          {route === 'conditionals' && <ComingSoonScreen area="conditionals" onNavigate={navigate} />}
          {route === 'functions' && <ComingSoonScreen area="functions" onNavigate={navigate} />}
          {route === 'dino-variables' && <DinoVariables {...experienceProps} />}
          {route === 'print-playground' && <PrintPlayground {...experienceProps} />}
          {route === 'black-box' && <BlackBox {...experienceProps} />}
          {route === 'input-machine' && <InputMachine {...experienceProps} />}
          {route === 'memory-machine' && <MemoryMachine {...experienceProps} />}
          {route === 'build-black-box' && <BuildBlackBox {...experienceProps} />}
          {route === 'final-bosses' && <FinalBosses {...experienceProps} />}
        </Suspense>
      </div>
      <PrintProgress progress={progress} />
    </div>
  )
}
