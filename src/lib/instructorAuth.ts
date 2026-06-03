const KEY = 'instructor_auth'
const CORRECT = import.meta.env.VITE_INSTRUCTOR_PIN ?? ''

export function isInstructorAuthed(): boolean {
  if (!CORRECT) return true  // Si no hay PIN configurado, permite acceso libre
  return sessionStorage.getItem(KEY) === CORRECT
}

export function setInstructorAuth(pin: string): boolean {
  if (pin === CORRECT) {
    sessionStorage.setItem(KEY, pin)
    return true
  }
  return false
}

export function clearInstructorAuth() {
  sessionStorage.removeItem(KEY)
}
