/**
 * Central permission registry.
 *
 * Every authorization check in the application should use one of these
 * permission constants instead of hardcoded strings.
 */

export const PERMISSIONS = {
  // Admin
  ADMIN_ACCESS: "admin.access",

  // Catalog
  PRODUCTS_READ: "products.read",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_UPDATE: "products.update",
  PRODUCTS_DELETE: "products.delete",

  // Orders
  ORDERS_READ: "orders.read",
  ORDERS_CREATE: "orders.create",
  ORDERS_UPDATE: "orders.update",
  ORDERS_CANCEL: "orders.cancel",
  ORDERS_REFUND: "orders.refund",

  // Payments
  PAYMENTS_READ: "payments.read",
  PAYMENTS_VERIFY: "payments.verify",
  PAYMENTS_REFUND: "payments.refund",

  // Inventory
  INVENTORY_READ: "inventory.read",
  INVENTORY_UPDATE: "inventory.update",

  // Customers
  CUSTOMERS_READ: "customers.read",
  CUSTOMERS_UPDATE: "customers.update",

  // Partners
  PARTNERS_READ: "partners.read",
  PARTNERS_APPROVE: "partners.approve",
  PARTNERS_UPDATE: "partners.update",

  // Distributors
  DISTRIBUTORS_READ: "distributors.read",
  DISTRIBUTORS_APPROVE: "distributors.approve",

  // Content
  CONTENT_CREATE: "content.create",
  CONTENT_UPDATE: "content.update",
  CONTENT_DELETE: "content.delete",

  // Diagnostics
  DIAGNOSTICS_VIEW: "diagnostics.view",

  // Settings
  SETTINGS_UPDATE: "settings.update",

  // Users
  USERS_READ: "users.read",
  USERS_UPDATE: "users.update",
  USERS_DELETE: "users.delete",
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];