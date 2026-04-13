'use client'

import { IoLogOutOutline } from 'react-icons/io5'

export function LogoutButton() {
  return (
    <form action="/api/auth/logout" method="POST">
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] text-cha hover:bg-vermillion-light hover:text-vermillion transition-all"
      >
        <IoLogOutOutline className="w-4 h-4 sm:hidden" />
        <span className="hidden sm:inline">Sign out</span>
        <span className="sm:hidden">Out</span>
      </button>
    </form>
  )
}
