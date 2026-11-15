import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import Order from "../../models/Order.js";
import subOrderItems from "../../models/orderItems.js";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

function pageParams(req: Request) {
  const requestedLimit = Number(req.query.limit);
  const requestedPage = Number(req.query.page);
  const limit =
    Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  return { limit, page, skip: (page - 1) * limit };
}

function yearRange(req: Request) {
  const yearParam = String(req.query.year ?? "");
  const currentYear = new Date().getFullYear();
  const selectedYear =
    yearParam === "all" ? null : Number(yearParam) || currentYear;
  if (!selectedYear) return { selectedYear: null, match: {} };
  return {
    selectedYear,
    match: {
      createdAt: {
        $gte: new Date(Date.UTC(selectedYear, 0, 1)),
        $lt: new Date(Date.UTC(selectedYear + 1, 0, 1)),
      },
    },
  };
}

export const getUserOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const customerID = (req as any).user.id;
    const customerOid = new mongoose.Types.ObjectId(customerID);
    const { limit, page, skip } = pageParams(req);
    const { selectedYear, match: yearMatch } = yearRange(req);

    const [orderResult, statsResult] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            customerID: customerOid,
            paymentStatus: { $ne: "pending" },
            ...yearMatch,
          },
        },
        {
          $facet: {
            metadata: [{ $count: "total" }],
            orders: [
              { $sort: { createdAt: -1 } },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  customerID: 0,
                  shippingAddress: 0,
                  paymentMethod: 0,
                  __v: 0,
                },
              },
            ],
          },
        },
      ]),
      subOrderItems.aggregate([
        {
          $match: {
            customerID: customerOid,
            status: { $ne: "pending" },
            ...yearMatch,
          },
        },
        {
          $facet: {
            orderStatuses: [
              {
                $group: {
                  _id: { order: "$ParentorderID", status: "$status" },
                },
              },
            ],
            summary: [
              {
                $group: {
                  _id: null,
                  notYetShipped: {
                    $sum: {
                      $cond: [{ $in: ["$status", ["processing"]] }, 1, 0],
                    },
                  },
                  cancelled: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
                    },
                  },
                  delivered: {
                    $sum: {
                      $cond: [{ $eq: ["$status", "delivered"] }, 1, 0],
                    },
                  },
                },
              },
            ],
          },
        },
      ]),
    ]);

    const facet = orderResult?.[0];
    const totalOrders = facet?.metadata?.[0]?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalOrders / limit));
    const currentPage = Math.min(page, totalPages);

    const stats = statsResult?.[0];

    const statusesByOrder = new Map<string, Set<string>>();
    for (const row of stats?.orderStatuses ?? []) {
      const key = row._id.order.toString();
      const set = statusesByOrder.get(key) ?? new Set<string>();
      set.add(row._id.status);
      statusesByOrder.set(key, set);
    }

    const orders = (facet?.orders ?? []).map((order: any) => {
      const key = order._id.toString();
      return {
        ...order,
        statuses: Array.from(statusesByOrder.get(key) ?? []),
      };
    });

    const summary = stats?.summary?.[0];
    res.status(200).json({
      success: true,
      currentPage,
      totalPages,
      totalOrders,
      year: selectedYear ?? "all",
      counts: {
        notYetShipped: summary?.notYetShipped ?? 0,
        cancelled: summary?.cancelled ?? 0,
        delivered: summary?.delivered ?? 0,
      },
      orders,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const customerID = (req as any).user.id;

    const order = await Order.findOne({
      _id: req.params.orderId,
      customerID,
    }).lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const subOrders = await subOrderItems
      .find({ ParentorderID: order._id })
      .populate("vendorID", "name companyName mobilenumber")
      .populate("items.productID", "name images price discount brand stock")
      .lean();

    res.status(200).json({ success: true, order, subOrders });
  } catch (error) {
    next(error);
  }
};
