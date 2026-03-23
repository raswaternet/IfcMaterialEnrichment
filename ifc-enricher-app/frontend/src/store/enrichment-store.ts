import { create } from 'zustand'
import type { DraftAssignment } from '../types'

type State = {
  assignments: DraftAssignment[]
  addAssignment: (assignment: DraftAssignment) => void
  removeAssignment: (id: string) => void
  clearAssignments: () => void
}

export const useEnrichmentStore = create<State>((set) => ({
  assignments: [],
  addAssignment: (assignment) => set((state) => ({ assignments: [...state.assignments.filter((item) => item.id !== assignment.id), assignment] })),
  removeAssignment: (id) => set((state) => ({ assignments: state.assignments.filter((item) => item.id !== id) })),
  clearAssignments: () => set({ assignments: [] }),
}))
