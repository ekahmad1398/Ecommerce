import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import Review from "../../models/Review.js";
import ProductSchema from "../../models/Product.js";
import subOrderItems from "../../models/orderItems.js";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const isValidRating = (rating: unknown): rating is number =>
  Number.isInteger(rating) && (rating as number) >= 1 && (rating as number) <= 5;

const isValidComment = (comment: unknown): comment is string | undefined =>
  comment === undefined ||
  (typeof comment === "string" && comment.length <= 1000);

// recalculate aggregate so rating can't drift; zero reviews -> rating 0
const syncProductRating = async (productId: string) => {
  const [stats] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  await ProductSchema.updateOne(
    { _id: productId },
    {
      rating: Number(((stats?.avgRating ?? 0) as number).toFixed(1)),
      reviewCount: stats?.count ?? 0,
    },
  );
};

const findOwnedReview = async (reviewId: string, customerID: string) => {
  if (!mongoose.isValidObjectId(reviewId)) return null;
  const review = await Review.findById(reviewId).select("user product").lean();
  if (!review || review.user.toString() !== customerID) return null;
  return review;
};

export const getProductReviews = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }

    const requestedLimit = Number(req.query.limit);
    const requestedPage = Number(req.query.page);
    const limit =
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_LIMIT)
        : DEFAULT_LIMIT;
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const product = await ProductSchema.findOne({
      _id: productId,
      status: "active",
      isDeleted: { $ne: true },
    })
      .select("rating reviewCount")
      .lean();

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const [reviews, total] = await Promise.all([
      Review.find({ product: productId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name")
        .lean(),
      Review.countDocuments({ product: productId }),
    ]);

    res.status(200).json({
      success: true,
      rating: product.rating,
      reviewCount: product.reviewCount,
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      total,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

export const createReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const customerID = (req as any).user.id;
    const { productID, rating, comment } = req.body ?? {};

    if (!mongoose.isValidObjectId(productID)) {
      return res.status(400).json({ success: false, message: "Invalid product ID." });
    }
    if (!isValidRating(rating)) {
      return res.status(400).json({ success: false, message: "Rating must be a whole number between 1 and 5." });
    }
    if (!isValidComment(comment)) {
      return res.status(400).json({ success: false, message: "Comment must be text under 1000 characters." });
    }

    const product = await ProductSchema.findOne({
      _id: productID,
      status: "active",
      isDeleted: { $ne: true },
    }).select("_id");
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const purchased = await subOrderItems.exists({
      customerID,
      "items.productID": productID,
      status: { $in: ["processing", "shipped", "delivered"] },
    });
    if (!purchased) {
      return res.status(403).json({
        success: false,
        message: "You can only review products you have purchased.",
      });
    }

    const existing = await Review.findOne({
      user: customerID,
      product: productID,
    }).select("_id");
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product.",
        reviewId: existing._id.toString(),
      });
    }

    const review = await Review.create({
      user: customerID,
      product: productID,
      rating,
      comment: comment ?? "",
    });

    await syncProductRating(productID);

    res.status(201).json({ success: true, review });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product.",
      });
    }
    next(error);
  }
};

export const updateReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const customerID = (req as any).user.id;
    const reviewId = String(req.params.reviewId);
    const { rating, comment } = req.body ?? {};

    if (!isValidRating(rating)) {
      return res.status(400).json({ success: false, message: "Rating must be a whole number between 1 and 5." });
    }
    if (!isValidComment(comment)) {
      return res.status(400).json({ success: false, message: "Comment must be text under 1000 characters." });
    }

    const owned = await findOwnedReview(reviewId, customerID);
    if (!owned) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    const review = await Review.findByIdAndUpdate(
      reviewId,
      { rating, comment: comment ?? "" },
      { returnDocument: "after" },
    ).lean();

    await syncProductRating(owned.product.toString());

    res.status(200).json({ success: true, review });
  } catch (error) {
    next(error);
  }
};

export const deleteReview = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const customerID = (req as any).user.id;
    const reviewId = String(req.params.reviewId);

    const owned = await findOwnedReview(reviewId, customerID);
    if (!owned) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    await Review.findByIdAndDelete(reviewId);
    await syncProductRating(owned.product.toString());

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
