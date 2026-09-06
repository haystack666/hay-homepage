import { createContext, useContext } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'

type TabsContextValue = {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

type TabsProps = HTMLAttributes<HTMLDivElement> & {
  value: string
  onValueChange: (value: string) => void
}

export function Tabs({ value, onValueChange, children, ...props }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div {...props}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" className={className || undefined} {...props} />
}

type TabsTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string
}

export function TabsTrigger({ value, className = '', ...props }: TabsTriggerProps) {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('TabsTrigger must be used within Tabs.')
  }

  const active = context.value === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={[active ? 'is-active' : '', className].filter(Boolean).join(' ') || undefined}
      onClick={() => context.onValueChange(value)}
      {...props}
    />
  )
}
