import "server-only";

import { revalidatePath } from "next/cache";

export const Cache = {
  homepage() {
    revalidatePath("/");
  },

  shop() {
    revalidatePath("/shop");
  },

  product(slug: string) {
    revalidatePath(`/p/${slug}`);
  },

  bundle(slug: string) {
    revalidatePath(`/bundles/${slug}`);
  },

  admin(path: string) {
    revalidatePath(path);
  },
};