import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import type { PrivateGroup } from '../types'

interface GroupMemberRow {
  group_id: string
  user_id: string
  role: 'admin' | 'member'
}

interface MemberProfile {
  id: string
  username: string
  full_name: string | null
}

export function GroupsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<PrivateGroup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [membersByGroup, setMembersByGroup] = useState<Record<string, GroupMemberRow[]>>({})
  const [profilesById, setProfilesById] = useState<Record<string, MemberProfile>>({})
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    const fetchGroups = async () => {
      setIsLoading(true)
      try {
        // Get groups created by user or where user is member
        const { data, error } = await supabase
          .from('private_groups')
          .select('*')
          .or(`created_by.eq.${user.id},id.in.(select group_id from group_members where user_id = '${user.id}')`)

        if (error) throw error

        const fetchedGroups = data || []
        setGroups(fetchedGroups)

        const groupIds = fetchedGroups.map((group) => group.id)

        if (groupIds.length === 0) {
          setMembersByGroup({})
          setProfilesById({})
          return
        }

        const { data: membersData, error: membersError } = await supabase
          .from('group_members')
          .select('group_id, user_id, role')
          .in('group_id', groupIds)

        if (membersError) throw membersError

        const groupedMembers: Record<string, GroupMemberRow[]> = {}
        ;(membersData || []).forEach((member) => {
          if (!groupedMembers[member.group_id]) {
            groupedMembers[member.group_id] = []
          }
          groupedMembers[member.group_id].push(member as GroupMemberRow)
        })
        setMembersByGroup(groupedMembers)

        const uniqueUserIds = Array.from(
          new Set((membersData || []).map((member) => member.user_id))
        )

        if (uniqueUserIds.length === 0) {
          setProfilesById({})
          return
        }

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, full_name')
          .in('id', uniqueUserIds)

        if (profilesError) throw profilesError

        const profileMap: Record<string, MemberProfile> = {}
        ;(profilesData || []).forEach((profile) => {
          profileMap[profile.id] = profile as MemberProfile
        })
        setProfilesById(profileMap)
      } catch (error) {
        console.error('Error fetching groups:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchGroups()
  }, [user, navigate])

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('private_groups')
        .insert({
          name: newGroupName,
          description: newGroupDesc,
          created_by: user.id,
        })
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        const newGroup = data[0]
        // Add creator as member
        await supabase.from('group_members').insert({
          group_id: newGroup.id,
          user_id: user.id,
          role: 'admin',
        })

        setGroups([...groups, newGroup])
        setNewGroupName('')
        setNewGroupDesc('')
        setIsCreating(false)
      }
    } catch (error) {
      console.error('Error creating group:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleLeaveGroup = async (groupId: string) => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id)

      if (error) throw error

      setGroups(groups.filter((g) => g.id !== groupId))
    } catch (error) {
      console.error('Error leaving group:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Mis Grupos Privados</h1>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-700 transition"
        >
          + Crear Grupo
        </button>
      </div>

      {isCreating && (
        <div className="bg-white p-6 rounded-lg shadow-md space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Crear Nuevo Grupo</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Mi Grupo de Figuras"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Descripción del grupo..."
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreateGroup}
              disabled={isLoading || !newGroupName.trim()}
              className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50"
            >
              {isLoading ? 'Creando...' : 'Crear Grupo'}
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Cargando grupos...</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No tienes grupos aún. ¡Crea uno o únete a uno!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {groups.map((group) => (
            <div key={group.id} className="bg-white p-6 rounded-lg shadow-md space-y-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{group.name}</h3>
                {group.description && (
                  <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-600">Código de Invitación</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    value={group.invite_code}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(group.invite_code)}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition"
                  >
                    Copiar
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setExpandedGroupId((current) => (current === group.id ? null : group.id))
                  }
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-700 transition"
                >
                  {expandedGroupId === group.id ? 'Ocultar Miembros' : 'Ver Miembros'}
                </button>
                {group.created_by === user?.id && (
                  <button
                    onClick={() => handleLeaveGroup(group.id)}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition"
                  >
                    Eliminar
                  </button>
                )}
                {group.created_by !== user?.id && (
                  <button
                    onClick={() => handleLeaveGroup(group.id)}
                    className="flex-1 bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-500 transition"
                  >
                    Salir
                  </button>
                )}
              </div>

              {group.created_by === user?.id && (
                <p className="text-xs text-gray-500">Eres el administrador de este grupo</p>
              )}

              {expandedGroupId === group.id && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Miembros del grupo
                  </p>
                  {(membersByGroup[group.id] || []).length === 0 ? (
                    <p className="text-sm text-gray-500">No hay miembros para mostrar.</p>
                  ) : (
                    <div className="space-y-2">
                      {(membersByGroup[group.id] || []).map((member) => {
                        const profile = profilesById[member.user_id]
                        const isMe = member.user_id === user?.id

                        return (
                          <div
                            key={`${group.id}-${member.user_id}`}
                            className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {profile?.full_name || profile?.username || member.user_id}
                              </p>
                              <p className="text-xs text-gray-500">
                                @{profile?.username || 'usuario'} · {member.role}
                              </p>
                            </div>

                            {!isMe && (
                              <button
                                onClick={() => navigate(`/profile/${member.user_id}`)}
                                className="rounded-md border border-primary-300 px-3 py-1 text-xs font-semibold text-primary-700 hover:bg-primary-50"
                              >
                                Ver perfil
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
