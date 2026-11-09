import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

import { personColor } from '../lib/colors'
import type { Member } from '../lib/types'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-line bg-card p-5 ${className}`}>{children}</section>
  )
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const look =
    variant === 'primary'
      ? 'bg-ink text-white active:bg-ink/85'
      : 'border border-line bg-card text-ink active:bg-bg'
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 font-semibold disabled:opacity-50 ${look} ${className}`}
    />
  )
}

export function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-12 w-full rounded-2xl border border-line bg-card px-4 text-base text-ink placeholder:text-muted/70 ${className}`}
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
      {children}
    </p>
  )
}

export function Avatar({ member, size = 40 }: { member: Pick<Member, 'name' | 'color'>; size?: number }) {
  const color = personColor(member.color)
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        backgroundColor: color.tint,
        color: color.value,
      }}
    >
      {member.name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function FullScreenMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6 py-10">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      {children}
    </main>
  )
}
