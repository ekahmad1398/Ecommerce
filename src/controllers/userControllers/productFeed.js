import ProductSchema from "../../models/Product.js";

export const FeedProducts = async (req, res, next) => {
  try {
    const { category, search, minPrice, maxPrice, rating, discount } =
      req.query;

    const matchCriteria = { status: "active" };

    if (category) {
      matchCriteria.category = category;
    }
    if (search) {
      matchCriteria.name = { $regex: search, $options: "i" };
    }
    if (minPrice || maxPrice) {
      matchCriteria.price = {};
      if (minPrice) matchCriteria.price.$gte = Number(minPrice);
      if (maxPrice) matchCriteria.price.$lte = Number(maxPrice);
    }
    if (rating) {
      matchCriteria.rating.$gte = Number(rating);
    }
    if (discount) {
      matchCriteria.discount.$gte = Number(discount);
    }

    const totalProducts = await ProductSchema.countDocuments(matchCriteria);
    const limit = Math.min(Math.max(Number(req.query.limit || 10, 1)), 50);
    const totalPages = Math.ceil(totalProducts / limit);
    const page = Math.min(Math.max(Number(req.query.page) || 1, 1), totalPages);
    const skip = (page - 1) * limit;

    const products = await ProductSchema.find(matchCriteria)
      .populate("categoryID", "name")
      .populate("vendorId", "storeSlug companyName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit()
      .lean();

    const formatedData = products.map((product) => {
      return {
        id: product._id,
        storeSlug: product.storeSlug,
        price: product.price,
        stock: product.stock,
        storeSlug: product.vendorId.companyName,
        storeName: product.vendorId.name,
        categoryName: product.categoryID.name,
        thumbNailImage: product.images[0],
      };
    });

    res.status(200).json({
      success: true,
      currentPage: page,
      totalPages,
      totalProducts,
      product: formatedData,
    });
  } catch (error) {
    next(error);
  }
};

export const specificProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await ProductSchema.findById(id)
      .populate("categoryID", "name attributes")
      .populate(
        "vendorId",
        "storeDescription companyName storeSlug mobilenumber Companyimage",
      )
      .lean();

    if (!product) {
      res
        .status(404)
        .json({
          success: false,
          message:
            "product not found or is no longer available on the marketplace",
        });
    }
    res.status(200).json({
      success: false,
      id: product._id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      stock: product.stock,
      stock: product?.description,
      images: product.images,
      category: {
        allowedFilters: product.category.attributes,
        name: product.category.name,
      },
      store: {
        name: product.vendorId.companyName,
        slug: product.vendorId.storeSlug,
        PhoneNumber: product.vendorId.mobilenumber,
        Companyimage: product.vendorId.Companyimage,
        storeDescription: product.vendorId.storeDescription,
      },
    });
  } catch (error) {
    next(error);
  }
};