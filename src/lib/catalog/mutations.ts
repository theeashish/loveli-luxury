"use server";

/**
 * Catalog write operations. Every export is a Server Action.
 *
 * Authorization model:
 *   1. authorize(PERMISSIONS.*) — verifies the session holds the permission
 *      required for the action. Throws if the permission is missing.
 *   2. The mutation runs through the cookie-bound supabase client, so RLS is
 *      a second line of defence. If the permission check were ever bypassed,
 *      the catalog_*_write policies still reject the write.
 */

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, requireFounderAdmin } from "../auth/roles";
import { authorize, PERMISSIONS } from "../auth";
import { doubleRetailMinor } from "./retail-size-pricing";
import {
  buildStoragePrefix,
  processImage,
  renditionPath,
  validatePreSharp,
  type Rendition,
} from "./image-pipeline";
import type { Database } from "../../types/database";
import {
  createBundleSchema,
  createCategorySchema,
  createProductSchema,
  createVariantSchema,
  updateBundleSchema,
  updateCategorySchema,
  updateImageSchema,
  updateProductSchema,
  updateVariantSchema,
  type CreateBundleInput,
  type CreateCategoryInput,
  type CreateProductInput,
  type CreateVariantInput,
  type UpdateBundleInput,
  type UpdateCategoryInput,
  type UpdateImageInput,
  type UpdateProductInput,
  type UpdateVariantInput,
} from "./schemas";

type Client = SupabaseClient<Database>;
type Tables = Database["public"]["Tables"];

function bumpStorefront(paths: readonly string[]) {
  for (const p of paths) revalidatePath(p);
}
async function sibling50RetailMinor(
  supabase: Client,
  productId: number,
  excludeId?: number,
) {
  let query = supabase
    .from("product_variants")
    .select("id, retail_price_minor")
    .eq("product_id", productId)
    .eq("size_ml", 50)
    .limit(1);

  if (excludeId !== undefined) query = query.neq("id", excludeId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.retail_price_minor == null
    ? null
    : String(data.retail_price_minor);
}

async function retailFor100ml(
  supabase: Client,
  productId: number,
  fallbackRetailMinor: string | undefined,
  excludeId?: number,
) {
  const retail50 = await sibling50RetailMinor(supabase, productId, excludeId);
  return retail50 === null ? fallbackRetailMinor : doubleRetailMinor(retail50);
}

async function assert100mlDistributorAllowsRetail(
  supabase: Client,
  productId: number,
  retail50: string,
) {
  const { data: variant100, error } = await supabase
    .from("product_variants")
    .select("distributor_price_minor")
    .eq("product_id", productId)
    .eq("size_ml", 100)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!variant100 || variant100.distributor_price_minor == null) return;

  const retail100 = doubleRetailMinor(retail50);
  if (BigInt(String(variant100.distributor_price_minor)) > BigInt(retail100)) {
    throw new Error(
      "Lower the 100ml distributor price before changing the 50ml retail price.",
    );
  }
}

async function refresh100mlRetailFrom50(supabase: Client, productId: number) {
  const retail50 = await sibling50RetailMinor(supabase, productId);
  if (retail50 === null) return;

  const { data: variant100, error: readError } = await supabase
    .from("product_variants")
    .select("id, distributor_price_minor")
    .eq("product_id", productId)
    .eq("size_ml", 100)
    .limit(1)
    .maybeSingle();
  if (readError) throw readError;
  if (!variant100) return;

  const retail100 = doubleRetailMinor(retail50);
  if (BigInt(String(variant100.distributor_price_minor)) > BigInt(retail100)) {
    throw new Error(
      "Lower the 100ml distributor price before changing the 50ml retail price.",
    );
  }

  const { error: updateError } = await supabase
    .from("product_variants")
    .update({ retail_price_minor: retail100 })
    .eq("id", variant100.id);
  if (updateError) throw updateError;
}

// -----------------------------------------------------------------------------
// Categories
// -----------------------------------------------------------------------------

export async function createCategory(input: CreateCategoryInput) {
  const data = createCategorySchema.parse(input);
  await authorize(PERMISSIONS.PRODUCTS_CREATE);
  const supabase = await adminClient();
  const { error } = await supabase.from("categories").insert({
    slug: data.slug,
    name: data.name,
    parent_id: data.parentId ?? null,
    position: data.position,
    is_active: data.isActive,
  });
  if (error) throw error;
  bumpStorefront(["/shop"]);
}

export async function updateCategory(input: UpdateCategoryInput) {
  const data = updateCategorySchema.parse(input);
  await authorize(PERMISSIONS.PRODUCTS_UPDATE);
  const supabase = await adminClient();
  const patch: Tables["categories"]["Update"] = {};
  if (data.slug !== undefined) patch.slug = data.slug;
  if (data.name !== undefined) patch.name = data.name;
  if (data.parentId !== undefined) patch.parent_id = data.parentId;
  if (data.position !== undefined) patch.position = data.position;
  if (data.isActive !== undefined) patch.is_active = data.isActive;
  const { error } = await supabase
    .from("categories")
    .update(patch)
    .eq("id", data.id);
  if (error) throw error;
  bumpStorefront(["/shop"]);
}

export async function deleteCategory(id: number) {
  await authorize(PERMISSIONS.PRODUCTS_DELETE);
  const supabase = await adminClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
  bumpStorefront(["/shop"]);
}

// -----------------------------------------------------------------------------
// Products
// -----------------------------------------------------------------------------

export async function createProduct(
  input: CreateProductInput,
): Promise<{ id: number; slug: string }> {
  const data = createProductSchema.parse(input);
  await authorize(PERMISSIONS.PRODUCTS_CREATE);
  const supabase = await adminClient();
  const { data: row, error } = await supabase
    .from("products")
    .insert({
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      category_id: data.categoryId ?? null,
      is_active: data.isActive,
      meta_title: data.metaTitle ?? null,
      meta_description: data.metaDescription ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  bumpStorefront(["/shop", `/p/${row.slug}`]);
  return { id: row.id, slug: row.slug };
}

export async function updateProduct(input: UpdateProductInput) {
  const data = updateProductSchema.parse(input);
  await authorize(PERMISSIONS.PRODUCTS_UPDATE);
  const supabase = await adminClient();
  const patch: Tables["products"]["Update"] = {};
  if (data.slug !== undefined) patch.slug = data.slug;
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.categoryId !== undefined) patch.category_id = data.categoryId;
  if (data.isActive !== undefined) patch.is_active = data.isActive;
  if (data.metaTitle !== undefined) patch.meta_title = data.metaTitle;
  if (data.metaDescription !== undefined)
    patch.meta_description = data.metaDescription;

  const { data: row, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", data.id)
    .select()
    .single();
  if (error) throw error;
  bumpStorefront(["/shop", `/p/${row.slug}`]);
}

export async function deleteProduct(id: number) {
  await authorize(PERMISSIONS.PRODUCTS_DELETE);
  const supabase = await adminClient();
  const { data: existing, error: readErr } = await supabase
    .from("products")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  bumpStorefront(["/shop", existing ? `/p/${existing.slug}` : "/shop"]);
}

// -----------------------------------------------------------------------------
// Variants
// -----------------------------------------------------------------------------

export async function createVariant(input: CreateVariantInput) {
  await authorize(PERMISSIONS.PRODUCTS_UPDATE);
  await requireFounderAdmin();
  const supabase = await adminClient();
  const rawProductId = Number(input.productId);
  const rawSizeMl = Number(input.sizeMl);
  const normalizedInput =
    rawSizeMl === 100 && Number.isInteger(rawProductId)
      ? {
          ...input,
          retailPriceMinor: await retailFor100ml(
            supabase,
            rawProductId,
            String(input.retailPriceMinor),
          ),
        }
      : input;
  if (rawSizeMl === 50 && Number.isInteger(rawProductId)) {
    await assert100mlDistributorAllowsRetail(
      supabase,
      rawProductId,
      String(input.retailPriceMinor),
    );
  }
  const data = createVariantSchema.parse(normalizedInput);
  const retailPriceMinor = data.retailPriceMinor;

  const { error } = await supabase.from("product_variants").insert({
    product_id: data.productId,
    sku: data.sku,
    size_ml: data.sizeMl,
    retail_price_minor: retailPriceMinor,
    distributor_price_minor: data.distributorPriceMinor,
    internal_pv_per_bottle: data.internalPvPerBottle ?? 0,
    weight_g: data.weightG ?? null,
    inventory_qty: data.inventoryQty,
    is_active: data.isActive,
  });
  if (error) throw error;

  if (data.sizeMl === 50) {
    await refresh100mlRetailFrom50(supabase, data.productId);
  }
  await revalidateProductFromVariant(supabase, data.productId);
}

export async function updateVariant(input: UpdateVariantInput) {
  await requireFounderAdmin();
  await authorize(PERMISSIONS.PRODUCTS_UPDATE);
  const supabase = await adminClient();
  const rawId = Number(input.id);
  const { data: existing, error: existingError } = await supabase
    .from("product_variants")
    .select("product_id, size_ml")
    .eq("id", rawId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Variant not found");

  const rawSizeMl =
    input.sizeMl === undefined ? existing.size_ml : Number(input.sizeMl);
  const normalizedInput =
    rawSizeMl === 100
      ? {
          ...input,
          retailPriceMinor: await retailFor100ml(
            supabase,
            existing.product_id,
            input.retailPriceMinor === undefined
              ? undefined
              : String(input.retailPriceMinor),
            rawId,
          ),
        }
      : input;
  const data = updateVariantSchema.parse(normalizedInput);
  const effectiveProductId = existing.product_id;
  const effectiveSizeMl = data.sizeMl ?? existing.size_ml;
  const patch: Tables["product_variants"]["Update"] = {};
  if (data.sku !== undefined) patch.sku = data.sku;
  if (data.sizeMl !== undefined) patch.size_ml = data.sizeMl;
  if (data.retailPriceMinor !== undefined)
    patch.retail_price_minor = data.retailPriceMinor;
  if (data.distributorPriceMinor !== undefined)
    patch.distributor_price_minor = data.distributorPriceMinor;
  if (data.internalPvPerBottle !== undefined)
    patch.internal_pv_per_bottle = data.internalPvPerBottle;
  if (data.weightG !== undefined) patch.weight_g = data.weightG;
  if (data.inventoryQty !== undefined) patch.inventory_qty = data.inventoryQty;
  if (data.isActive !== undefined) patch.is_active = data.isActive;

  if (
    patch.distributor_price_minor !== undefined &&
    patch.retail_price_minor !== undefined &&
    BigInt(String(patch.distributor_price_minor)) >
      BigInt(String(patch.retail_price_minor))
  ) {
    throw new Error(
      "Distributor price cannot be higher than the retail price.",
    );
  }

  if (effectiveSizeMl === 50 && data.retailPriceMinor !== undefined) {
    await assert100mlDistributorAllowsRetail(
      supabase,
      effectiveProductId,
      data.retailPriceMinor,
    );
  }

  const { data: row, error } = await supabase
    .from("product_variants")
    .update(patch)
    .eq("id", data.id)
    .select()
    .single();
  if (error) throw error;

  if (row.size_ml === 50) {
    await refresh100mlRetailFrom50(supabase, row.product_id);
  }
  await revalidateProductFromVariant(supabase, row.product_id);
}
export async function deleteVariant(id: number) {
  await authorize(PERMISSIONS.PRODUCTS_DELETE);
  const supabase = await adminClient();
  const { data: row, error: readErr } = await supabase
    .from("product_variants")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  const { error } = await supabase
    .from("product_variants")
    .delete()
    .eq("id", id);
  if (error) throw error;
  if (row) await revalidateProductFromVariant(supabase, row.product_id);
}

async function revalidateProductFromVariant(
  supabase: Client,
  productId: number,
) {
  const { data } = await supabase
    .from("products")
    .select()
    .eq("id", productId)
    .maybeSingle();
  bumpStorefront(["/shop", data ? `/p/${data.slug}` : "/shop"]);
}

// -----------------------------------------------------------------------------
// Bundles
// -----------------------------------------------------------------------------

export async function createBundle(
  input: CreateBundleInput,
): Promise<{ id: number; slug: string }> {
  const data = createBundleSchema.parse(input);
  await authorize(PERMISSIONS.PRODUCTS_CREATE);
  const supabase = await adminClient();

  const { data: bundle, error: bErr } = await supabase
    .from("bundles")
    .insert({
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      retail_price_minor: data.retailPriceMinor,
      distributor_price_minor: data.distributorPriceMinor,
      currency: data.currency,
      is_starter_package: data.isStarterPackage,
      starter_package_code: data.starterPackageCode ?? null,
      is_active: data.isActive,
    })
    .select()
    .single();
  if (bErr) throw bErr;

  const { error: iErr } = await supabase.from("bundle_items").insert(
    data.items.map((it) => ({
      bundle_id: bundle.id,
      variant_id: it.variantId,
      quantity: it.quantity,
    })),
  );
  if (iErr) throw iErr;

  bumpStorefront(["/shop", `/bundles/${bundle.slug}`]);
  return { id: bundle.id, slug: bundle.slug };
}

export async function updateBundle(input: UpdateBundleInput) {
  const data = updateBundleSchema.parse(input);
  await authorize(PERMISSIONS.PRODUCTS_UPDATE);
  const supabase = await adminClient();
  const patch: Tables["bundles"]["Update"] = {};
  if (data.slug !== undefined) patch.slug = data.slug;
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.retailPriceMinor !== undefined)
    patch.retail_price_minor = data.retailPriceMinor;
  if (data.distributorPriceMinor !== undefined)
    patch.distributor_price_minor = data.distributorPriceMinor;
  if (data.currency !== undefined) patch.currency = data.currency;
  if (data.isStarterPackage !== undefined)
    patch.is_starter_package = data.isStarterPackage;
  if (data.starterPackageCode !== undefined)
    patch.starter_package_code = data.starterPackageCode;
  if (data.isActive !== undefined) patch.is_active = data.isActive;

  const { data: bundle, error } = await supabase
    .from("bundles")
    .update(patch)
    .eq("id", data.id)
    .select()
    .single();
  if (error) throw error;

  if (data.items) {
    const { error: delErr } = await supabase
      .from("bundle_items")
      .delete()
      .eq("bundle_id", data.id);
    if (delErr) throw delErr;
    const { error: insErr } = await supabase.from("bundle_items").insert(
      data.items.map((it) => ({
        bundle_id: data.id,
        variant_id: it.variantId,
        quantity: it.quantity,
      })),
    );
    if (insErr) throw insErr;
  }

  bumpStorefront(["/shop", `/bundles/${bundle.slug}`]);
}

export async function deleteBundle(id: number) {
  await authorize(PERMISSIONS.PRODUCTS_DELETE);
  const supabase = await adminClient();
  const { data: existing, error: readErr } = await supabase
    .from("bundles")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  const { error } = await supabase.from("bundles").delete().eq("id", id);
  if (error) throw error;
  bumpStorefront(["/shop", existing ? `/bundles/${existing.slug}` : "/shop"]);
}

// -----------------------------------------------------------------------------
// Image metadata (file upload itself is in src/lib/catalog/image-pipeline.ts)
// -----------------------------------------------------------------------------

export async function updateProductImage(input: UpdateImageInput) {
  const data = updateImageSchema.parse(input);
  await authorize(PERMISSIONS.PRODUCTS_UPDATE);
  const supabase = await adminClient();

  if (data.isPrimary === true) {
    const { data: row, error: readErr } = await supabase
      .from("product_images")
      .select()
      .eq("id", data.id)
      .single();
    if (readErr) throw readErr;
    const { error: clearErr } = await supabase
      .from("product_images")
      .update({
        is_primary: false,
      } satisfies Tables["product_images"]["Update"])
      .eq("product_id", row.product_id);
    if (clearErr) throw clearErr;
  }

  const patch: Tables["product_images"]["Update"] = {};
  if (data.alt !== undefined) patch.alt = data.alt;
  if (data.position !== undefined) patch.position = data.position;
  if (data.isPrimary !== undefined) patch.is_primary = data.isPrimary;

  const { error } = await supabase
    .from("product_images")
    .update(patch)
    .eq("id", data.id);
  if (error) throw error;
  bumpStorefront(["/shop"]);
}

export async function deleteProductImage(id: number) {
  await authorize(PERMISSIONS.PRODUCTS_DELETE);
  const supabase = await adminClient();
  const { data: row, error: readErr } = await supabase
    .from("product_images")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!row) return;

  await removeStorageRenditions(supabase, row.storage_prefix);

  const { error } = await supabase.from("product_images").delete().eq("id", id);
  if (error) throw error;

  // If we just deleted the primary, promote the lowest-position survivor.
  if (row.is_primary) {
    const { data: next } = await supabase
      .from("product_images")
      .select()
      .eq("product_id", row.product_id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase
        .from("product_images")
        .update({
          is_primary: true,
        } satisfies Tables["product_images"]["Update"])
        .eq("id", next.id);
    }
  }

  await revalidateProductFromId(supabase, row.product_id);
}

export async function updateBundleImage(input: UpdateImageInput) {
  const data = updateImageSchema.parse(input);
  await authorize(PERMISSIONS.PRODUCTS_UPDATE);
  const supabase = await adminClient();

  if (data.isPrimary === true) {
    const { data: row, error: readErr } = await supabase
      .from("bundle_images")
      .select()
      .eq("id", data.id)
      .single();
    if (readErr) throw readErr;
    const { error: clearErr } = await supabase
      .from("bundle_images")
      .update({ is_primary: false } satisfies Tables["bundle_images"]["Update"])
      .eq("bundle_id", row.bundle_id);
    if (clearErr) throw clearErr;
  }

  const patch: Tables["bundle_images"]["Update"] = {};
  if (data.alt !== undefined) patch.alt = data.alt;
  if (data.position !== undefined) patch.position = data.position;
  if (data.isPrimary !== undefined) patch.is_primary = data.isPrimary;

  const { error } = await supabase
    .from("bundle_images")
    .update(patch)
    .eq("id", data.id);
  if (error) throw error;
  bumpStorefront(["/shop"]);
}

export async function deleteBundleImage(id: number) {
  await authorize(PERMISSIONS.PRODUCTS_DELETE);
  const supabase = await adminClient();
  const { data: row, error: readErr } = await supabase
    .from("bundle_images")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!row) return;

  await removeStorageRenditions(supabase, row.storage_prefix);

  const { error } = await supabase.from("bundle_images").delete().eq("id", id);
  if (error) throw error;

  if (row.is_primary) {
    const { data: next } = await supabase
      .from("bundle_images")
      .select()
      .eq("bundle_id", row.bundle_id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase
        .from("bundle_images")
        .update({
          is_primary: true,
        } satisfies Tables["bundle_images"]["Update"])
        .eq("id", next.id);
    }
  }

  await revalidateBundleFromId(supabase, row.bundle_id);
}

// -----------------------------------------------------------------------------
// Image uploads (multipart server actions)
// -----------------------------------------------------------------------------

const RENDITIONS: ReadonlyArray<Rendition> = ["original", "display", "thumb"];

export async function uploadProductImage(
  formData: FormData,
): Promise<{ id: number; storagePrefix: string }> {
  const productId = Number(formData.get("productId"));
  if (!Number.isInteger(productId) || productId <= 0) {
    throw new Error("uploadProductImage: missing or invalid productId");
  }
  const file = formData.get("file");
  if (!(file instanceof File))
    throw new Error("uploadProductImage: missing file");

  validatePreSharp({ type: file.type, size: file.size });
  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await processImage(buffer);

  await authorize(PERMISSIONS.PRODUCTS_UPDATE);
  const supabase = await adminClient();
  const uuid = crypto.randomUUID();
  const prefix = buildStoragePrefix("products", productId, uuid);

  await uploadRenditions(supabase, prefix, processed);

  const { count } = await supabase
    .from("product_images")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  const isPrimary = (count ?? 0) === 0;

  const { data: row, error } = await supabase
    .from("product_images")
    .insert({
      product_id: productId,
      storage_prefix: prefix,
      width: processed.width,
      height: processed.height,
      is_primary: isPrimary,
    })
    .select()
    .single();
  if (error) {
    // Compensate: roll back the just-uploaded objects so we don't leak storage.
    await removeStorageRenditions(supabase, prefix);
    throw error;
  }

  await revalidateProductFromId(supabase, productId);
  return { id: row.id, storagePrefix: row.storage_prefix };
}

export async function uploadBundleImage(
  formData: FormData,
): Promise<{ id: number; storagePrefix: string }> {
  const bundleId = Number(formData.get("bundleId"));
  if (!Number.isInteger(bundleId) || bundleId <= 0) {
    throw new Error("uploadBundleImage: missing or invalid bundleId");
  }
  const file = formData.get("file");
  if (!(file instanceof File))
    throw new Error("uploadBundleImage: missing file");

  validatePreSharp({ type: file.type, size: file.size });
  const buffer = Buffer.from(await file.arrayBuffer());
  const processed = await processImage(buffer);

  await authorize(PERMISSIONS.PRODUCTS_UPDATE);
  const supabase = await adminClient();
  const uuid = crypto.randomUUID();
  const prefix = buildStoragePrefix("bundles", bundleId, uuid);

  await uploadRenditions(supabase, prefix, processed);

  const { count } = await supabase
    .from("bundle_images")
    .select("*", { count: "exact", head: true })
    .eq("bundle_id", bundleId);
  const isPrimary = (count ?? 0) === 0;

  const { data: row, error } = await supabase
    .from("bundle_images")
    .insert({
      bundle_id: bundleId,
      storage_prefix: prefix,
      width: processed.width,
      height: processed.height,
      is_primary: isPrimary,
    })
    .select()
    .single();
  if (error) {
    await removeStorageRenditions(supabase, prefix);
    throw error;
  }

  await revalidateBundleFromId(supabase, bundleId);
  return { id: row.id, storagePrefix: row.storage_prefix };
}

async function uploadRenditions(
  supabase: Client,
  prefix: string,
  processed: Awaited<ReturnType<typeof processImage>>,
): Promise<void> {
  const targets = [
    { rendition: "original" as const, body: processed.original },
    { rendition: "display" as const, body: processed.display },
    { rendition: "thumb" as const, body: processed.thumb },
  ];
  const uploads = await Promise.all(
    targets.map((t) =>
      supabase.storage
        .from("catalog")
        .upload(renditionPath(prefix, t.rendition), t.body, {
          contentType: "image/webp",
          upsert: false,
        }),
    ),
  );
  for (const r of uploads) {
    if (r.error) {
      // Best-effort cleanup of any successful uploads in this batch.
      await removeStorageRenditions(supabase, prefix);
      throw r.error;
    }
  }
}

async function removeStorageRenditions(
  supabase: Client,
  prefix: string,
): Promise<void> {
  const paths = RENDITIONS.map((r) => renditionPath(prefix, r));
  // Errors here are intentionally swallowed — the caller is already in an
  // error or cleanup path and a missing object is non-fatal.
  await supabase.storage.from("catalog").remove(paths);
}

async function revalidateProductFromId(
  supabase: Client,
  productId: number,
): Promise<void> {
  const { data } = await supabase
    .from("products")
    .select()
    .eq("id", productId)
    .maybeSingle();
  bumpStorefront(["/shop", data ? `/p/${data.slug}` : "/shop"]);
}

async function revalidateBundleFromId(
  supabase: Client,
  bundleId: number,
): Promise<void> {
  const { data } = await supabase
    .from("bundles")
    .select()
    .eq("id", bundleId)
    .maybeSingle();
  bumpStorefront(["/shop", data ? `/bundles/${data.slug}` : "/shop"]);
}
