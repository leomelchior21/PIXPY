import { loadClassProgress } from './classroomCloud'

const cloud = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => cloud }))

it('preserves the external users group without assigning a seventh-grade class', async () => {
  cloud.rpc.mockResolvedValueOnce({
    data: [{ username: 'gueststudent', display_name: 'Guest Student', class_name: null, group_name: 'external' }],
    error: null,
  })

  expect(await loadClassProgress('leleomaker')).toEqual([{
    username: 'gueststudent',
    displayName: 'Guest Student',
    className: null,
    team: 'external',
    progress: null,
    updatedAt: null,
    lastLoginAt: null,
  }])
})
