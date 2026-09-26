import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Typed Link, useRouter, usePathname, redirect, etc. bound to our locale config.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
