"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GUEST_COOKIE } from "@/lib/guest";

export async function enterGuestMode() {
  const store = await cookies();
  store.set(GUEST_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/board");
}

export async function exitGuestMode() {
  const store = await cookies();
  store.delete(GUEST_COOKIE);
  redirect("/");
}
