import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import App, { TABS, type TabId } from './App'

export function pathToTab(pathname: string): TabId {
  if (pathname.startsWith('/file/')) return `file:${pathname.slice('/file/'.length)}`
  return (TABS.find((t) => t.path === pathname)?.id ?? 'overview') as TabId
}

export function Shell() {
  const { pathname } = useLocation()
  return <App tab={pathToTab(pathname)} />
}

export function Root() {
  return <><Shell /><Outlet /></>
}

export function NotFound() {
  const navigate = useNavigate()
  useEffect(() => {
    void navigate({ to: '/' })
  }, [navigate])
  return null
}
