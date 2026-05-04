import "server-only";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { env } from "@/lib/env";
import { type InvoiceStatus } from "@/modules/invoices/invoice.schemas";

import { PortalRepository } from "./portal.repository";
import { signPortalToken, verifyPortalToken } from "./portal-token";

export type PortalInvoiceListItem = {
  id: string;
  number: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  total: string;
  amountPaid: string;
  amountDue: string;
};

export type PortalInvoiceLine = {
  id: string;
  sortOrder: number;
  description: string;
  sku: string | null;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
};

export type PortalInvoiceDetail = {
  id: string;
  number: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  taxRate: string;
  taxInclusive: boolean;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  notes: string | null;
  sellerNameSnapshot: string | null;
  sellerTaxNumberSnapshot: string | null;
  sellerAddressSnapshot: string | null;
  buyerNameSnapshot: string | null;
  buyerTaxNumberSnapshot: string | null;
  buyerAddressSnapshot: string | null;
  lines: PortalInvoiceLine[];
};

// Statuses customers can see
const PORTAL_VISIBLE_INVOICE_STATUSES = [
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
] as const;

export class PortalService {
  constructor(private readonly repository = new PortalRepository()) {}

  private async buildPortalUrl(orderId: string, accessId: string) {
    const token = await signPortalToken({ orderId, accessId });
    return `${env.APP_URL}/portal/${token}`;
  }

  async getStaffPortalAccess(factoryId: string, orderId: string) {
    const access = await this.repository.getStaffAccess(factoryId, orderId);

    if (!access) {
      return null;
    }

    return {
      id: access.id,
      createdAt: access.createdAt.toISOString(),
      lastViewedAt: access.lastViewedAt?.toISOString() ?? null,
      url: await this.buildPortalUrl(orderId, access.id),
    };
  }

  async createStaffPortalAccess(
    factoryId: string,
    orderId: string,
    sharedById: string,
  ) {
    const access = await this.repository.upsertAccess(
      factoryId,
      orderId,
      sharedById,
    );

    if (!access) {
      throw new Error("Order not found in this factory.");
    }

    await recordAudit({
      factoryId,
      actorUserId: sharedById,
      action: "PORTAL_LINK_CREATED",
      entityType: "PortalAccess",
      entityId: access.id,
      metadata: { orderId },
    });

    return {
      id: access.id,
      createdAt: access.createdAt.toISOString(),
      lastViewedAt: access.lastViewedAt?.toISOString() ?? null,
      url: await this.buildPortalUrl(orderId, access.id),
    };
  }

  async getPortalOrder(token: string) {
    const payload = await verifyPortalToken(token);
    const detail = await this.repository.getByAccess(
      payload.accessId,
      payload.orderId,
    );

    if (!detail) {
      return null;
    }

    await this.repository.markViewed(detail.access.id);

    return {
      ...detail,
      order: {
        ...detail.order,
        events: detail.order.events.filter((event) =>
          [
            "CREATED",
            "STATUS_CHANGED",
            "ASSIGNMENT_STATUS_CHANGED",
            "PORTAL_SHARED",
            "PORTAL_APPROVED",
          ].includes(event.type),
        ),
      },
    };
  }

  async approveOrder(token: string, note?: string) {
    const payload = await verifyPortalToken(token);
    const current = await this.repository.getByAccess(
      payload.accessId,
      payload.orderId,
    );

    if (!current) {
      throw new Error("Portal access is no longer valid.");
    }

    if (current.order.status !== "QUOTED") {
      throw new Error("Only quoted orders can be approved from the portal.");
    }

    await this.repository.approve(payload.accessId, payload.orderId, note);

    return this.getPortalOrder(token);
  }

  async getInvoicesForToken(token: string): Promise<{
    factory: {
      name: string;
      portalDisplayName: string | null;
      currency: string;
    };
    order: { id: string; code: string; title: string };
    invoices: PortalInvoiceListItem[];
  } | null> {
    const detail = await this.getPortalOrder(token);
    if (!detail) return null;

    const orderId = detail.order.id;
    const orderRow = await db.order.findUnique({
      where: { id: orderId },
      select: { factoryId: true },
    });
    if (!orderRow) return null;

    const rows = await db.invoice.findMany({
      where: {
        factoryId: orderRow.factoryId,
        orderId,
        deletedAt: null,
        status: { in: [...PORTAL_VISIBLE_INVOICE_STATUSES] },
      },
      orderBy: [{ issueDate: "desc" }, { numberSeq: "desc" }],
      select: {
        id: true,
        number: true,
        status: true,
        issueDate: true,
        dueDate: true,
        currency: true,
        total: true,
        amountPaid: true,
      },
    });

    const invoices: PortalInvoiceListItem[] = rows.map((inv) => {
      const due = inv.total.minus(inv.amountPaid);
      return {
        id: inv.id,
        number: inv.number,
        status: inv.status as InvoiceStatus,
        issueDate: inv.issueDate.toISOString(),
        dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
        currency: inv.currency,
        total: decToString(inv.total),
        amountPaid: decToString(inv.amountPaid),
        amountDue: decToString(due),
      };
    });

    return {
      factory: {
        name: detail.factory.name,
        portalDisplayName: detail.factory.portalDisplayName,
        currency: detail.factory.currency,
      },
      order: {
        id: detail.order.id,
        code: detail.order.code,
        title: detail.order.title,
      },
      invoices,
    };
  }

  async getInvoiceForToken(
    token: string,
    invoiceId: string,
  ): Promise<{
    factory: {
      name: string;
      portalDisplayName: string | null;
      currency: string;
    };
    order: { id: string; code: string; title: string };
    invoice: PortalInvoiceDetail;
  } | null> {
    const detail = await this.getPortalOrder(token);
    if (!detail) return null;

    const order = await db.order.findUnique({
      where: { id: detail.order.id },
      select: { factoryId: true },
    });
    if (!order) return null;

    const inv = await db.invoice.findFirst({
      where: {
        id: invoiceId,
        factoryId: order.factoryId,
        orderId: detail.order.id,
        deletedAt: null,
        status: { in: [...PORTAL_VISIBLE_INVOICE_STATUSES] },
      },
      include: { lines: true },
    });
    if (!inv) return null;

    const due = inv.total.minus(inv.amountPaid);
    const lines: PortalInvoiceLine[] = [...inv.lines]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => ({
        id: l.id,
        sortOrder: l.sortOrder,
        description: l.description,
        sku: l.sku ?? null,
        quantity: l.quantity.toFixed(4),
        unitPrice: l.unitPrice.toFixed(4),
        lineTotal: decToString(l.lineTotal),
      }));

    const invoice: PortalInvoiceDetail = {
      id: inv.id,
      number: inv.number,
      status: inv.status as InvoiceStatus,
      issueDate: inv.issueDate.toISOString(),
      dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
      currency: inv.currency,
      taxRate: inv.taxRate.toFixed(2),
      taxInclusive: inv.taxInclusive,
      subtotal: decToString(inv.subtotal),
      discountAmount: decToString(inv.discountAmount),
      taxAmount: decToString(inv.taxAmount),
      total: decToString(inv.total),
      amountPaid: decToString(inv.amountPaid),
      amountDue: decToString(due),
      notes: inv.notes ?? null,
      sellerNameSnapshot: inv.sellerNameSnapshot ?? null,
      sellerTaxNumberSnapshot: inv.sellerTaxNumberSnapshot ?? null,
      sellerAddressSnapshot: inv.sellerAddressSnapshot ?? null,
      buyerNameSnapshot: inv.buyerNameSnapshot ?? null,
      buyerTaxNumberSnapshot: inv.buyerTaxNumberSnapshot ?? null,
      buyerAddressSnapshot: inv.buyerAddressSnapshot ?? null,
      lines,
    };

    return {
      factory: {
        name: detail.factory.name,
        portalDisplayName: detail.factory.portalDisplayName,
        currency: detail.factory.currency,
      },
      order: {
        id: detail.order.id,
        code: detail.order.code,
        title: detail.order.title,
      },
      invoice,
    };
  }
}
