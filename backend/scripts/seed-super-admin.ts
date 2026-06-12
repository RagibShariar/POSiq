// Creates (or resets) the platform super-admin account.
// Usage: npx tsx scripts/seed-super-admin.ts <email> <password>

import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/utils/password";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/seed-super-admin.ts <email> <password>");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Super admin password must be at least 12 characters.");
    process.exit(1);
  }

  const hashed = await hashPassword(password);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, role: "SUPER_ADMIN", isActive: true, deletedAt: null },
    create: {
      email,
      name: "Super Admin",
      password: hashed,
      role: "SUPER_ADMIN",
      businessId: null,
    },
  });

  console.log(`Super admin ready: ${admin.email} (id: ${admin.id})`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
