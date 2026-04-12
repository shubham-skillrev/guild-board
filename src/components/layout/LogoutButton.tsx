'use client'

export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        className="px-2.5 py-1.5 rounded-md text-[13px] text-cha hover:bg-vermillion-light hover:text-vermillion transition-all"
      >
        Sign out
      </button>
    </form>
  )
}
