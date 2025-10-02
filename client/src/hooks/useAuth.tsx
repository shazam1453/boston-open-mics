import React, { createContext, useContext, useState, useEffect } from 'react'
import { authAPI } from '../utils/api'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (userData: {
    email: string
    password: string
    name: string
    phone?: string
    performerType?: string
    bio?: string
  }) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const response = await authAPI.getProfile()
          setUser(response.data.user)
        } catch (error) {
          localStorage.removeItem('token')
          setToken(null)
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [token])

  const login = async (email: string, password: string) => {
    const response = await authAPI.login(email, password)
    const { token: newToken, user: newUser } = response.data
    
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(newUser)
  }

  const register = async (userData: {
    email: string
    password: string
    name: string
    phone?: string
    performerType?: string
    bio?: string
  }) => {
    const response = await authAPI.register(userData)
    const { token: newToken, user: newUser } = response.data
    
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    token,
    login,
    register,
    logout,
    loading
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}