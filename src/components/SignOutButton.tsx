"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="px-4 py-2 text-slate-300 hover:text-white transition text-sm"
    >
      Sign Out
    </button>
  );
}
