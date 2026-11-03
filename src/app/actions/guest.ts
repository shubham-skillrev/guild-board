"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GUEST_COOKIE, GUEST_COOKIE_OPTIONS } from "@/lib/guest";

export async function enterGuestMode() {
  const store = await cookies();
  store.set(GUEST_COOKIE, "1", GUEST_COOKIE_OPTIONS);
  redirect("/board");
}

export async function exitGuestMode() {
  const store = await cookies();
  store.delete(GUEST_COOKIE);
  // Not "/": that is the board, which would put them straight back in.
  redirect("/about");
}
