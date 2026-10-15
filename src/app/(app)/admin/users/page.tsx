import { redirect } from "next/navigation";

/** "Users & roles" became two pages: Staff (who is staff, their permissions) and Customers. */
export default function UsersPage() {
  redirect("/admin/staff");
}
