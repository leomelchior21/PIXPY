import { lazy, Suspense, useEffect, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { Hud } from './components/Hud'
import { isTeacherAccess, normalizeAccessId } from './lib/access'
import { clearProfile, loadProfile, saveProfile } from './lib/storage'
import { AvatarScreen } from './screens/AvatarScreen'
import { HomeScreen } from './screens/HomeScreen'
import { JourneyScreen } from './screens/JourneyScreen'
import { LoginScreen } from './screens/LoginScreen'
import { ProfileScreen } from './screens/ProfileScreen'
import { TeacherScreen } from './screens/TeacherScreen'
import type { AppRoute, StudentProfile } from './types'

const validRoutes: AppRoute[] = ['login', 'avatar', 'home', 'journey', 'ranking', 'profile', 'dino-lab', 'teacher']

const DinoLabScreen = lazy(() => import('./screens/DinoLabScreen').then((module) => ({ default: module.DinoLabScreen })))
const RankingScreen = lazy(() => import('./screens/RankingScreen').then((module) => ({ default: module.RankingScreen })))

function initialRoute(profile: StudentProfile | null): AppRoute {
  if (!profile) return 'login'
  if (!profile.avatarId) return 'avatar'
  const hash = window.location.hash.replace('#/', '') as AppRoute
  if (validRoutes.includes(hash) && hash !== 'login' && hash !== 'avatar') return hash
  return 'home'
}

export default function App() {
  const [profile, setProfile] = useState<StudentProfile | null>(() => loadProfile())
  const [route, setRoute] = useState<AppRoute>(() => initialRoute(loadProfile()))
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('pixpy.sound') !== 'off')

  useEffect(() => {
    const onHashChange = () => {
      if (!profile) return
      const hashRoute = window.location.hash.replace('#/', '') as AppRoute
      if (validRoutes.includes(hashRoute) && hashRoute !== 'login') setRoute(hashRoute)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [profile])

  const navigate = (nextRoute: AppRoute) => {
    if (nextRoute === 'teacher' && !profile?.isTeacher) return
    setRoute(nextRoute)
    if (nextRoute !== 'login' && nextRoute !== 'avatar') window.location.hash = `/${nextRoute}`
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const identify = async (rawAccessId: string) => {
    const accessId = normalizeAccessId(rawAccessId)
    let nextProfile: StudentProfile
    if (await isTeacherAccess(accessId)) {
      nextProfile = {
        id: crypto.randomUUID(),
        accessId,
        displayName: 'Leo',
        avatarId: null,
        xp: 0,
        completedMissions: [],
        badges: [],
        isTeacher: true,
        lastActiveAt: new Date().toISOString(),
      }
    } else {
      const { identifyStudent } = await import('./lib/supabase')
      nextProfile = await identifyStudent(accessId)
    }
    setProfile(nextProfile)
    saveProfile(nextProfile)
    setRoute(nextProfile.avatarId ? 'home' : 'avatar')
  }

  const updateProfile = (nextProfile: StudentProfile) => {
    setProfile(nextProfile)
    saveProfile(nextProfile)
  }

  const chooseAvatar = (avatarId: string) => {
    if (!profile) return
    const nextProfile = { ...profile, avatarId }
    updateProfile(nextProfile)
    void import('./lib/supabase')
      .then(({ saveCloudProfile }) => saveCloudProfile(nextProfile))
      .catch(() => undefined)
    navigate('home')
  }

  const logout = () => {
    clearProfile()
    setProfile(null)
    setRoute('login')
    window.history.replaceState(null, '', window.location.pathname)
  }

  const toggleSound = () => {
    setSoundOn((current) => {
      const next = !current
      localStorage.setItem('pixpy.sound', next ? 'on' : 'off')
      return next
    })
  }

  if (!profile || route === 'login') return <LoginScreen onIdentify={identify} />
  if (route === 'avatar') return <AvatarScreen displayName={profile.displayName} initialAvatar={profile.avatarId} onComplete={chooseAvatar} />

  return (
    <div className={`app-shell ${route === 'dino-lab' ? 'app-shell--lab' : ''}`}>
      <Hud profile={profile} route={route} soundOn={soundOn} onToggleSound={toggleSound} onNavigate={navigate} />
      <div className="app-content">
        <Suspense fallback={<RouteLoader />}>
          {route === 'home' && <HomeScreen profile={profile} onNavigate={navigate} />}
          {route === 'journey' && <JourneyScreen profile={profile} onNavigate={navigate} />}
          {route === 'ranking' && <RankingScreen profile={profile} />}
          {route === 'profile' && <ProfileScreen profile={profile} onChangeAvatar={() => setRoute('avatar')} onLogout={logout} />}
          {route === 'teacher' && profile.isTeacher && <TeacherScreen onNavigate={navigate} />}
          {route === 'dino-lab' && <DinoLabScreen profile={profile} onBack={() => navigate('home')} onUpdateProfile={updateProfile} />}
        </Suspense>
      </div>
      {route !== 'dino-lab' && route !== 'teacher' && <BottomNav route={route} onNavigate={navigate} />}
    </div>
  )
}

function RouteLoader() {
  return <div className="route-loader" role="status"><span /> Loading lab signal...</div>
}
